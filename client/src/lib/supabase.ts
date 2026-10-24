import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Read explicitly so a misconfigured deploy fails with a clear message rather
// than a cryptic "Invalid supabaseUrl" from deep inside the client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].filter(Boolean).join(" and ");
  // NEXT_PUBLIC_ vars are inlined at build time, so these must be plain/Config
  // env vars (not Secret, which is injected only at runtime).
  throw new Error(`Supabase is not configured: ${missing} is missing. Set it as a plain (Config) env var, available at build time.`);
}
if (!/^https?:\/\//.test(url)) {
  throw new Error(`Supabase URL is invalid: NEXT_PUBLIC_SUPABASE_URL must start with http(s)://, got "${url}".`);
}

export const supabase = createClient<Database>(url, key);
