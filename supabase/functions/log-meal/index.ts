// ============================================================================
// Kenko: log-meal edge function - the pipeline's one server-side brain.
//
// The client POSTs a meal photo (and/or free text). This function:
//   1. embeds the photo                                  [provider stubbed]
//   2. runs a pgvector similarity search against the caller's own dish library
//   3a. known dish  -> recipe nutrition x calibration multiplier
//   3b. new dish    -> retrieve grounding ingredients, ask a frontier model
//                      to reason over them               [provider stubbed]
//   4. inserts a DRAFT meal_logs row (confirmed = false); the client shows it
//      for confirmation and patches confirmed = true directly via supabase-js.
//
// The two provider functions below are deliberate placeholders pending a
// personal accuracy bake-off (see scripts/bakeoff.py). Everything around
// them - branching, grounding retrieval, cost logging, the draft-row
// contract - is the real logic.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Cosine similarity above this counts as "one of my known dishes".
const MATCH_THRESHOLD = 0.8;

interface LogMealRequest {
  userId: string;
  imageBase64?: string;
  textInput?: string;
  dishwareId?: string;
}

// ----------------------------------------------------------------------------
// AI providers - STUBS. Wire in the bake-off winner here.
// ----------------------------------------------------------------------------

/**
 * Embed a meal photo into the same vector space as dishes.embedding.
 * Must return a vector whose dimension matches the schema (vector(768) by
 * default - change both together if the chosen model differs).
 */
async function embedMealPhoto(_imageBase64: string): Promise<number[]> {
  // TODO: call the embedding provider chosen by scripts/bakeoff.py, then
  // record the call via logAiCall(..., "embedding", ...).
  throw new Error(
    "embedMealPhoto is not wired to a provider yet - run scripts/bakeoff.py, pick a winner, and implement this call.",
  );
}

/**
 * Frontier-model reasoning for a dish that didn't match the personal library:
 * given the photo/text plus retrieved reference ingredients, estimate the
 * dish's nutrition. Grounded in the provided rows, not the model's memory.
 */
async function reasonOverUnfamiliarDish(_input: {
  imageBase64?: string;
  textInput?: string;
  groundingIngredients: unknown[];
}): Promise<{
  dishName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}> {
  // TODO: call the frontier model chosen by the bake-off with the grounding
  // rows in the prompt, then record the call via logAiCall(..., "reasoning", ...).
  throw new Error(
    "reasonOverUnfamiliarDish is not wired to a provider yet - see scripts/bakeoff.py.",
  );
}

// ----------------------------------------------------------------------------
// Cost guardrail: every provider call gets a row in ai_call_log
// ----------------------------------------------------------------------------
async function logAiCall(
  userId: string,
  provider: string,
  model: string,
  purpose: "embedding" | "classification" | "reasoning",
  estimatedCostUsd: number,
  mealLogId?: string,
) {
  await supabase.from("ai_call_log").insert({
    user_id: userId,
    provider,
    model,
    purpose,
    estimated_cost_usd: estimatedCostUsd,
    meal_log_id: mealLogId,
  });
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: LogMealRequest = await req.json();
    const { userId, imageBase64, textInput, dishwareId } = body;

    if (!userId || (!imageBase64 && !textInput)) {
      return json({ error: "userId and one of imageBase64/textInput are required" }, 400);
    }

    // --- Text-only path: parsing "one and a half plates of X" is stubbed ---
    if (!imageBase64) {
      return json(
        {
          error:
            "Text-only logging is not implemented yet - send a photo, or log manually from the client.",
        },
        501,
      );
    }

    // --- 1. Embed the photo -------------------------------------------------
    const embedding = await embedMealPhoto(imageBase64);

    // --- 2. Closed-set match against the caller's own dish library ---------
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_dish_by_embedding",
      {
        query_embedding: embedding,
        match_user_id: userId,
        match_threshold: MATCH_THRESHOLD,
        match_count: 1,
      },
    );
    if (matchError) throw matchError;

    // Portion estimation is deliberately deferred: assume a typical portion
    // until dishware fill-level comparison is built (see PROJECT.md).
    const portionRatio = 1.0;

    let draft;
    if (matches && matches.length > 0) {
      // --- 3a. Known dish: recipe nutrition x calibration multiplier -------
      const dish = matches[0];

      const { data: calibration } = await supabase
        .from("dish_calibration")
        .select("correction_multiplier")
        .eq("dish_id", dish.id)
        .maybeSingle();
      const multiplier = calibration?.correction_multiplier ?? 1.0;

      const grams = (dish.reference_serving_g ?? 100) * portionRatio * multiplier;
      const per100 = grams / 100;

      draft = {
        user_id: userId,
        dish_id: dish.id,
        dishware_id: dishwareId,
        portion_ratio: portionRatio,
        calories: round1(dish.calories_per_100g * per100),
        protein_g: round1(dish.protein_g_per_100g * per100),
        carbs_g: round1(dish.carbs_g_per_100g * per100),
        fat_g: round1(dish.fat_g_per_100g * per100),
        fiber_g: round1((dish.fiber_g_per_100g ?? 0) * per100),
        raw_text_input: textInput,
        source: "ai_estimate",
        match_confidence: dish.similarity,
        confirmed: false,
      };
    } else {
      // --- 3b. Unfamiliar dish: ground a frontier model in reference data --
      const { data: groundingIngredients, error: groundError } = await supabase
        .from("wafct_ingredients")
        .select("*")
        .limit(50); // TODO: retrieve by relevance to the photo/text, not a blind limit
      if (groundError) throw groundError;

      const estimate = await reasonOverUnfamiliarDish({
        imageBase64,
        textInput,
        groundingIngredients: groundingIngredients ?? [],
      });

      draft = {
        user_id: userId,
        dishware_id: dishwareId,
        portion_ratio: portionRatio,
        calories: round1(estimate.calories),
        protein_g: round1(estimate.protein_g),
        carbs_g: round1(estimate.carbs_g),
        fat_g: round1(estimate.fat_g),
        fiber_g: round1(estimate.fiber_g),
        raw_text_input: textInput,
        source: "ai_estimate",
        confirmed: false,
      };
    }

    // --- 4. Insert the draft row; the client confirms it separately --------
    const { data: inserted, error: insertError } = await supabase
      .from("meal_logs")
      .insert(draft)
      .select()
      .single();
    if (insertError) throw insertError;

    return json({ mealLog: inserted }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
