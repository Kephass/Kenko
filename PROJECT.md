# Kenko — project overview

Kenko (健康, "health") is a personal nutrition and body-tracking app. It
exists because generic food-tracking apps are built around food databases
that don't cover most of the world's cuisines well, and their AI food
recognition is trying to solve a genuinely unsolved problem: identifying
*any* food in the world from a photo. This project sidesteps that problem
instead of trying to beat it.

The reference implementation here was built around Ghanaian and Angolan
cuisine, because that's a clean, real example of the gap: there's a
legitimate ingredient-level nutrition database for Ghana (the FAO/INFOODS
West African Food Composition Table), but Angola has no food composition
database of its own at all. Nothing in the architecture is specific to
these two cuisines, though - see
[Adapting this for a different cuisine](#adapting-this-for-a-different-cuisine-or-person)
below.

## Why not just use an existing app

Three specific gaps, not a general complaint about existing apps:

1. **Food databases are Western-centric.** If your cuisine isn't well
   represented, every calorie estimate downstream is guesswork wearing a
   precise-looking number.
2. **Portion-size estimation from an arbitrary photo is genuinely unsolved.**
   Real-world testing of photo-based calorie apps consistently finds
   identification is decent but portion sizing is the weak link - this isn't
   a "pick a better model" problem, it's a hard open problem in computer
   vision.
3. **Your data lives on someone else's server.** A subscription app owns
   your eating history, weight history, and meal photos. This doesn't.

## What this is, structurally

Instead of trying to recognize any food in the world, Kenko turns food
logging into a **closed-set problem**: you maintain a personal library of
the ~20-40 dishes you actually eat on repeat, computed once from real
ingredient data, and the AI's job becomes "is this one of my known dishes"
(cheap, fast, high-accuracy) rather than "what is this food" (expensive,
slow, low-accuracy for underrepresented cuisines). New or unfamiliar dishes
fall through to a slower path where a frontier model reasons over retrieved
ingredient-level nutrition data rather than recalling a specific dish's
nutrition facts from memory - which is exactly where generic models are
weakest for underrepresented cuisines.

## Feature set

### Implemented

| Feature | Notes |
|---|---|
| Body measurements | Waist, hip, chest, neck, thigh, arm over time |
| Body-fat estimate | Navy method, computed from waist/neck(/hip) + height |
| Weight trend | Exponentially-weighted moving average (α = 0.15) smooths daily noise into a trend line, computed automatically on every weigh-in via a database trigger |
| Water logging | Simple timestamped volume entries |
| Weekly energy balance | Rolling 7-day window (not calendar-week), calories in from meal logs, calories out from BMR (Katch-McArdle once a body-fat estimate exists, Mifflin-St Jeor otherwise) plus wearable activity data when available |
| Macro tracking | Protein, carbs, fat, fiber per meal and rolled up over time |
| Personal dish library | Your own recipes, computed once from ingredient-level data, reused forever |
| Closed-set dish matching | pgvector cosine similarity search against your own dish embeddings - no model call needed just to check "have I seen this before" |
| Per-user data isolation | Row-level security on every user-owned table; any number of people can use one Kenko project without seeing each other's data |
| Cost guardrail | `ai_call_log` table for tracking AI API spend per call |

### Partially built - branching logic is done, the providers aren't wired in

| Feature | Status |
|---|---|
| Meal photo → embedding | Interface defined in the edge function, provider call is a placeholder pending a personal accuracy bake-off (see below) |
| Unfamiliar-dish reasoning | Same - branching and grounding-context retrieval are implemented, the actual model call is a placeholder |
| Portion-ratio estimation | Currently defaults to 1.0 (assumes a typical portion). Comparing photo fill-level against a pre-calibrated dishware reference photo is real work, deliberately deferred |
| Text/voice logging | Stubbed - parsing free text like "one and a half plates of X" into a structured log entry isn't implemented yet |

### Planned

- Client app (PWA, or Expo if Health/wearable integration turns out to matter)
- A script to import a food composition table (WAFCT or your own cuisine's
  equivalent) into `wafct_ingredients`
- A script to generate and store embeddings for an initial dish library
- Per-dish calibration: comparing AI portion estimates against real kitchen-
  scale weigh-ins over time and adjusting a correction multiplier accordingly
- Optional, later: a small personally-trained classifier to replace routine
  API calls once enough labeled examples exist

## Project structure

```
.
├── README.md                                    quick start
├── PROJECT.md                                   this file
├── .env.example                                  local dev secrets template
├── .gitignore
└── supabase/
    ├── migrations/
    │   └── 20260707120000_initial_schema.sql     full schema - tables, RLS,
    │                                              triggers, helper functions
    └── functions/
        └── log-meal/
            └── index.ts                          the pipeline's orchestration
                                                    logic ("the brain")
```

Not yet present, but implied by the architecture below:

```
    └── (client app, not started)                 PWA or Expo, talks directly
                                                    to Supabase for simple CRUD
                                                    and to log-meal for anything
                                                    AI-related
```

## Architecture

The guiding rule: **thin client, one brain, managed everything else.** The
client does UI, camera capture, and direct reads/writes to Postgres for
anything simple (weigh-ins, water, measurements). Exactly one server-side
entry point - the `log-meal` edge function - handles anything involving AI,
because that's the only place an API key can live safely.

```
        client (PWA or Expo)
                │
                ├── direct read/write, via Supabase SDK + RLS ──► Postgres
                │                                                (weigh-ins,
                │                                                 measurements,
                │                                                 water, etc.)
                │
                └── POST photo/text ──► log-meal edge function
                                              │
                                              ├─► pgvector similarity search
                                              │   against your dish library
                                              │
                                              ├─► known dish: pull recipe +
                                              │   calibration multiplier
                                              │
                                              ├─► new dish: retrieve grounding
                                              │   ingredients, call a frontier
                                              │   model to reason over them
                                              │
                                              └─► write to meal_logs
```

**Why Supabase.** Managed Postgres, storage, auth, and edge functions in one
place, with no server to keep alive - important for a project without a
dedicated ops person. `pgvector` living inside the same Postgres instance
means the "personalization" story is just rows and vectors accumulating in
a table, not a training pipeline.

**Why the edge function is TypeScript, not Python.** Supabase Edge Functions
run on a Deno runtime that's TypeScript-first; Python isn't a supported
option there. That's fine, because the live orchestration logic (check a
vector index, call an HTTP API, parse JSON, write a row) is plumbing, not
data science. Python is genuinely the better tool for the offline pieces of
this project instead - importing a food composition spreadsheet, computing
recipe nutrition from ingredient data, running an AI-provider bake-off - all
of which are scripts you run once or occasionally, never part of the live
request path.

## Data model

| Table | Purpose |
|---|---|
| `user_profile` | Height, birth date, sex, goal, activity multiplier - static inputs to the BMR calculation |
| `dishes` | Your personal recipe library: nutrition per 100g, reference serving size, embedding for photo matching |
| `dish_ingredients` | Ingredient-level breakdown for dishes computed bottom-up |
| `dishware` | Your own bowls/plates, pre-calibrated once so portion estimates become relative, not absolute |
| `meal_logs` | Every logged meal - calories, macros, source (AI estimate / manual / scale / text), confirmation status |
| `dish_calibration` | Per-dish correction multiplier, refined over time from real scale weigh-ins |
| `weigh_ins` | Raw weight plus the computed EWMA trend |
| `measurements` | Tape measurements by type and date |
| `water_logs` | Timestamped water volume |
| `activity` | Calories burned and steps, from a wearable or a formula-based estimate |
| `wafct_ingredients` | Shared reference ingredient data (see note below) - not user-scoped |
| `ai_call_log` | Cost guardrail: every AI API call logged with an estimated cost |

Every user-owned table carries a `user_id` and a row-level security policy
scoping it to `auth.uid()`. `wafct_ingredients` is the one shared, globally-
readable table, since it's reference data rather than personal data.

## Adapting this for a different cuisine (or person)

Two separate things can vary independently, and neither requires touching
the schema:

- **A different person** using the same cuisine focus: just needs their own
  Supabase Auth account. Row-level security already isolates every user's
  dishes, logs, and measurements from everyone else's - this was built in
  from the start, not bolted on.
- **A different cuisine**: `wafct_ingredients` is named after this reference
  implementation's data source (the West African table), but its structure
  - `food_code`, `name`, macros per 100g - is generic. Populate it from
  whatever composition table actually covers your cuisine (USDA FoodData
  Central, Brazil's TACO table, a national table, or your own bottom-up
  ingredient data), and the grounding logic in `log-meal` works unchanged.
  Each person's own dish library is, by definition, already specific to
  whatever they cook - that part never needed to be generic in the first
  place.

## Design principles

The recurring decisions across this project, stated once instead of
repeated in every file:

- **Closed-set beats open-set.** Matching against a small personal library
  is a tractable problem; recognizing arbitrary food from a photo isn't.
- **Relative beats absolute.** Estimating portion size as a ratio against a
  pre-calibrated reference (your own bowl, your own usual serving) is far
  more achievable than estimating absolute grams from scratch.
- **Rolling windows beat calendar resets.** A 7-day rolling energy balance
  reflects how the body actually works; a Monday-reset weekly budget is a
  psychological artifact.
- **Ground the model, don't trust its memory.** Retrieved ingredient data in
  the prompt beats hoping a model recalls a specific dish's nutrition
  facts correctly.
- **One deployment target beats two.** Everything that must run live stays
  inside Supabase; anything that doesn't (data import, embedding generation,
  provider bake-offs) is offline tooling that never needs to be deployed.
- **You own the data.** Self-hosted Postgres and storage under your own
  account, exportable anytime.

## Tech stack

| Layer | Choice |
|---|---|
| Client | PWA (React/Next.js) by default; Expo/React Native if deep Health/wearable integration matters |
| Database | Supabase Postgres, with `pgvector` for dish-embedding similarity search |
| Storage | Supabase Storage, for meal photos |
| Auth | Supabase Auth, with row-level security enforcing per-user isolation |
| Orchestration | One Supabase Edge Function (Deno/TypeScript) |
| AI | Cheap-tier or pure embedding similarity for known-dish matching; frontier-tier model + retrieved ingredient grounding for unfamiliar dishes - provider chosen via a personal accuracy bake-off, not a benchmark |
| Offline tooling | Python, for data import, recipe computation, and provider evaluation - never part of the live path |
| Hosting | Supabase (managed) for the backend; Vercel/Netlify or EAS for the client |

## Status & roadmap

**Done:** schema, RLS, body-fat/BMR/trend/energy-balance functions, pgvector
dish matching, edge function branching logic - all tested against a live
Postgres + pgvector instance.

**In progress:** wiring a real AI provider into the two placeholder
functions in `log-meal/index.ts`, once a personal bake-off picks one.

**Not started:** the client app, the WAFCT/reference-data import script, the
dish-embedding generation script, portion-ratio estimation, text/voice
parsing, the calibration feedback loop.

## Getting started

See [README.md](./README.md) for setup steps, and
[SCAFFOLD.md](./SCAFFOLD.md) for the ordered checklist to build out
everything still marked "not started" above.
