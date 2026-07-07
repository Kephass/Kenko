# Kenko Roadmap

Seven phases, each shipped as one PR into `main`. Every phase with a schema change adds one migration in `supabase/migrations/` and regenerates `client/src/lib/types.ts`. Tick boxes as work lands.

**AI provider decision:** Gemini only (Flash for vision/reasoning, `text-embedding-004` for 768-dim embeddings — matches the existing `vector(768)` column).

## Phase 1 — Manual logging + full CRUD

The app's core loop, with zero AI. Everything else depends on this.

- [x] Migration: `meal_logs.dish_id` / `dishware_id` FKs → `on delete set null`
- [x] Manual mode on `/log`: pick dish (grams or × serving) or free-form macros; insert `source:'manual', confirmed:true`
- [x] Editable macros on the confirm screen (wire the existing `edits` param)
- [x] Hooks: `useAddManualMealLog`, `useUpdateMealLog`, `useDeleteMealLog`
- [x] Dashboard meal cards → edit/delete sheet
- [x] Dish edit/delete + fiber field on `/dishes`
- [x] Root `loading.tsx` + `error.tsx`

## Phase 2 — Progress & analytics

- [x] Migration: `recompute_weight_trend()` + AFTER trigger (backfill-safe EWMA); `daily_nutrition_summary()` RPC
- [x] WeekStrip: tappable days with real progress rings; `selectedDate` drives the dashboard
- [x] `/history`: month calendar, calorie/macro charts, weight + measurement trends
- [x] Body-fat estimate surfaced on `/weight` and `/measurements` (`latest_body_fat_estimate`)
- [x] Weigh-in backfill (date input)

## Phase 3 — PWA install + offline

- [ ] Serwist via `@serwist/turbopack` (`src/app/sw.ts` + route handler); exclude Supabase URLs from SW cache
- [ ] Typed `src/app/manifest.ts`; fix theme_color mismatch; real icons (maskable + apple-touch)
- [ ] TanStack offline persistence (IndexedDB): per-user cache buster, module-scope mutation defaults for offline queue, never persist the AI mutation
- [ ] Offline indicator; manual logging works offline

## Phase 4 — Goals & onboarding

- [ ] Migration: `user_profile` += macro split pcts (sum=100 check), `water_goal_ml`, `calorie_target_override`, `target_weight_kg`, `fiber_goal_g`
- [ ] `lib/goals.ts` profile-driven (cut −15% / bulk +10% / override); kill hardcoded 30/40/30 and 2000 ml
- [ ] Shared `useProfile` hook
- [ ] `/onboarding` wizard; redirect when session exists but no profile
- [ ] Settings: macro split, water goal, target weight; `/weight` progress toward target

## Phase 5 — Public-ready auth

- [ ] Migration: all user-table FKs to `auth.users` → `on delete cascade`
- [ ] Edge function `delete-account` (JWT-resolved user, storage cleanup, admin delete)
- [ ] Forgot password + `/reset-password` page; `PUBLIC_ROUTES` allowlist in Providers
- [ ] Settings: change password/email, type-to-confirm account deletion
- [ ] Optional: Google OAuth; dashboard hardening (leaked-password protection, redirect allowlist)

## Phase 6 — Photo storage + AI logging (Gemini)

- [ ] Run `scripts/import_reference_ingredients.py` against the real WAFCT file
- [ ] Migration: private `meal-photos` bucket + per-user folder RLS
- [ ] `log-meal`: vision describe → embed description → dish match; grounded reasoning fallback; real text path; `logAiCall` on every request; accept `photoPath`
- [ ] Client: compress + upload photo before invoke; signed-URL thumbnails; AI usage in settings
- [ ] `scripts/generate_dish_embeddings.py` (Gemini) run over dish library

## Phase 7 — Push reminders + polish

- [ ] Migration: `push_subscriptions` + RLS; reminder prefs; `pg_cron`/`pg_net` schedule (secrets via Vault)
- [ ] Edge function `send-reminders` (Deno-native VAPID/Web Push)
- [ ] SW push + notificationclick handlers; settings subscribe UI
- [ ] Per-route loading/error files; vitest for `lib/`; README refresh
