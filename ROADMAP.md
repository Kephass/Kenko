# Kenko roadmap — food and water first

Updated 13 September 2026. This roadmap supersedes the original seven-phase ordering.
The goal is a dependable everyday food and water diary inspired by the useful parts of WeightWatchers, adapted to a personal dish library. Kenko uses transparent calories, grams, nutrients and millilitres. It does not reproduce WW's proprietary Points system.

## Product priorities

1. Know what you ate and drank: names, quantities, dates, meal categories and corrections.
2. Make repeat tracking quick: personal dishes, favorites and recent entries.
3. See progress: editable targets, daily totals and an easy-to-browse diary.
4. Keep entries reliable: validation, offline persistence, account isolation and visible sync failures.
5. Make the app welcoming: a distinctive, accessible login with working recovery.

WW references reviewed: [tracking](https://www.weightwatchers.com/uk/blog/everything-you-need-know-about-tracking-weightwatchersr-app), [app tips](https://www.weightwatchers.com/us/blog/tips-for-using-the-app), [water tracking](https://www.weightwatchers.com/ca/en/blog/starter-guide-faq-water-tracking).

## Existing baseline

- [x] Personal dish and meal CRUD, manual logging.
- [x] Weight and measurement tracking, trend calculations, history calendar and charts.
- [x] PWA installation, service worker and offline meal creation.

## Current implementation

These items are applied to the original repository and linked Kenko database. Seven SQL scripts pass. Food, water, catalog and recipe flows have authenticated browser coverage; remaining release checks are listed separately.

- [x] Food logger opens with saved dishes and quick add; incomplete AI scan removed from the primary flow.
- [x] Search dishes, filter favorites and search/reuse recent meals with half, double or custom fractional portions.
- [x] Saved foods accept nutrition labels per serving or per 100 g, with conversion using the declared serving weight.
- [x] Grams or fractional servings with nutrient preview and explicit serving size.
- [x] Keep food names and fiber in entries, previews and edits.
- [x] Explicit meal date/time; preserve it through offline sync and reload.
- [x] Breakfast/lunch/dinner/snack grouping and category editing. Existing entries remain uncategorized.
- [x] Food and water loggers inherit the selected diary day; selected dates survive URL navigation and logging returns to the same day.
- [x] History links open the selected diary day; zero-calorie logged days remain visible and history failures are distinguished from empty days.
- [x] Browse the daily diary by date; category totals and daily calorie/macro/fiber/water progress.
- [x] Water quick add, custom positive amounts, dated diary and amount/date/time corrections/deletion, with rollback across diary days.
- [x] Saved-dish creation/edits/deletion and favorites persist offline with original authorship and duplicate-safe replay.
- [x] Offline food corrections and water writes, ordered replay, duplicate-safe additions, visible failures and retry.
- [x] Undo food and water deletion, including queued delete/restore after offline reload.
- [x] Unsynced/failed writes survive ordinary cache expiry; failed writes are retained for retry during long-lived sessions.
- [x] Per-account in-memory and persisted caches; migrate the previous cache only for its owner.
- [x] Editable calorie target, macro percentages totalling 100%, water and fiber targets.
- [x] Shared profile hook and consistent targets in dashboard, history and water.
- [x] Responsive login redesign with original food imagery, labelled forms, password visibility and account creation.
- [x] Password-reset request and recovery page; public-route allowlist.
- [x] Regression tests for measurement, dates, offline replay and account changes.
- [x] Optional quick-add nutrients preserve unknown values through edits, recent reuse and offline sync; diary marks incomplete progress.
- [x] Additive migration and SQL constraint test script.
- [x] Recipe nutrition calculator from saved foods, ingredient weights, finished batch weight and fractional serving count. Save calculated nutrition as a reusable dish.
- [x] Water entry/display/correction in ml or US fl oz, stored as ml; three named container presets saved per account in this browser.
- [x] Food portion input in ounces, grams or fractional servings with equivalent quantities when switching units.
- [x] Keyboard access, loading/error states and useful serving labels in the dish library.

## Release gate — complete before calling this shipped

- [x] Apply the supplied patch in the original Kenko repository after `git apply --check`.
- [x] Apply all eight supplied migrations to a development database; run `supabase/tests/food_water_goals.sql`, `supabase/tests/recipe_details.sql`, `supabase/tests/saved_meals.sql`, `supabase/tests/water_preferences.sql`, `supabase/tests/daily_target_snapshots.sql`, `supabase/tests/nutrition_completeness.sql`, and `supabase/tests/energy_fallback.sql`.
- [x] Regenerate Supabase types from the migrated schema.
- [x] Run ordinary build and inspect mobile/desktop layouts in the actual app (login at desktop/phone widths; authenticated recipe editor at 390 px).
- [ ] Verify sign-in, confirmed and confirmation-required sign-up, password recovery and expired-link handling against Supabase.
- [ ] Add the correct localhost and production recovery/confirmation URLs to the Supabase Auth redirect allowlist.
- [ ] Verify real data isolation with two test accounts, offline/reload/reconnect, and create/edit/delete of food and water.
- [ ] Verify PWA installation and persistence on the target phone.

## Next useful increment

- [x] Optional first-use target setup for calories/water/fiber and macro split, with immediate logging available and no required body-profile fields.
- [x] Persist recipe ingredient nutrition snapshots, weights, yield and serving count for reopening/editing, including offline dish replay.
- [x] Copy an entire logged meal category to a chosen date/time, preserving individual foods and offline replay.
- [x] Named multi-food templates independent of diary history: save from diary, search/rename/delete in Saved meals, and log fractional portions to any day with offline persistence.
- [x] Account-owned water container/unit preferences with offline ordered replay and a browser fallback. Existing local presets sync when explicitly saved; latest synced write wins.
- [x] Append-only daily target observations retain the actual calorie/macro/water/fiber targets when tracking screens load successfully. Historical diary/water use the last observation for that local day; charts omit target marks on unrecorded days. No invented backfill; explicit current-target comparison for missing history. Offline snapshots keep their capture date and original owner.
- [x] Persist profile/target edits through offline reload, with ordered replay, original-account checks, validation, pending-value display and confirmed-cache preservation after failure.
- [x] Unknown nutrients in saved foods remain blank through edits and logging; recipes with incomplete nutrient inputs leave that saved total unknown. Legacy zeros remain unchanged.
- [x] Historical aggregate completeness counts through a versioned summary RPC, with missing nutrient counts shown for the selected day.
- [ ] Optional label/barcode lookup after choosing a reference food source with adequate coverage.
- [ ] Target-weight progress and optional goal-based calorie estimates. For now the weight-goal field is descriptive; explicit calorie targets control the budget.

## Later

- Public account management: email/password changes, export/deletion, server-side storage cleanup.
- AI photo logging using grounded reference data, storage, authenticated user resolution and cost logging. Existing provider functions are stubs; do not activate them as-is.
- Optional reminders only after tracking is reliable.
- Wearable integration if it serves a concrete need.

Community feeds, coaching, clinical services, badges, proprietary Points and program-specific exceptions are outside the core scope.

Energy estimate fix: missing weight, height, birth date or sex now yields an unavailable expenditure estimate rather than fabricated body inputs. The diary uses its explicit 2,000-calorie starting target. Migration 20260913155312_honest_energy_fallback.sql applied; live SQL regression and authenticated UI check passed.

## Food & drink catalog — September 2026

- [x] Searchable reference catalog: 3,195 entries from USDA SR Legacy plus five transparent Kenko mocktail recipes. Includes 291 fruit, 814 vegetable, 290 bean/legume, 418 drink, 12 cocktail, 756 meal, 181 grain, 291 dairy/egg and 137 nut/seed entries. Counts include preparation variants, not unique species.
- [x] Category filters, accent-insensitive word-prefix search, grams and source-defined portions; scale calories, protein, carbohydrates, fat and fiber to the measured amount.
- [x] Review nutrition and preserve the selected diary date/category before logging through the existing offline-capable food flow. Drink energy does not automatically count as water.
- [x] Source links, explicit recipe estimates, unknown nutrient preservation and reproducible import script with archive checksum. Catalog loads separately and can be reused offline after loading.
- [ ] Expand regional produce, common-name synonyms and popular cocktails/mocktails against documented sources. Broad starter coverage is available; exhaustive worldwide fruit/vegetable coverage is not claimed.
- [x] Save catalog references to My dishes for repeat logging and use as recipe ingredients. Preserve source notes, unknown nutrients and the selected weight as a serving; queued saves replay offline.

Catalog validation: 54 application tests, ESLint, TypeScript and production build pass. Authenticated browser verification includes a 150 g banana entry (133.5 calories), preserving the selected historical date.

Recipe integration verification: a catalog ingredient was saved into Test banana recipe, reloaded and reopened with its 300 g ingredient, 240 g finished yield and two 120 g servings intact. Mobile recipe editor inspected at 390×844. Actual network-disconnect/reload/reconnect testing remains pending: the available browser controls do not expose network emulation. Unit-level persisted replay tests pass; these are not a substitute for target-device PWA testing.

## Active development backlog

External release checks do not block independent food/water development. Continue the following useful increments while phone/inbox/network checks remain pending.

- [x] Catalog meal basket: add several measured foods, edit/remove portions, review total calories, choose a shared date and meal category, then log distinct editable entries with existing duplicate-safe offline replay.
- [x] Retain unfinished meal baskets across reload/navigation in account/day-scoped browser storage, including unfinished weight fields, time and category. Explicit discard and clear-on-log; malformed snapshots rejected and storage errors surfaced.
- [x] Preparation filters for raw/cooked/canned/dried/frozen foods based on explicit source wording; multiple preparations can apply.
- [x] Common-name search aliases (including courgette, aubergine, garbanzo, rocket and groundnut), punctuation-tolerant matching and main-name/short-description ranking.
- [x] Source/reference notes expand in the personal dish editor, with original-reference versus personal-edit clarification.
- [ ] Review food/water diary accessibility and correction flows as these additions land.

Basket validation: 55 tests pass, including multiple portions, unknown nutrients, historical date/category and persisted duplicate-safe replay. Authenticated UI and database confirm a 60 g banana (53.4 cal) plus 30 g banana pepper (8.1 cal), saved as separate snack entries on September 12. No migration required.

Search increment validation: 56 tests, lint, TypeScript and production build pass. Authenticated UI confirmed courgette plus Raw returns the two raw zucchini source records. Nutrition data unchanged; no migration.

Draft validation: 57 tests, lint, TypeScript and production build pass. Authenticated browser reload retained an87gbanana draft with its original time and Snack category; discard remained empty after reload. Drafts are local to the browser, not cross-device. No migration.

- [x] Save a named reusable meal directly from an unfinished catalog basket, without logging foods or clearing the draft. Captures measured nutrition snapshots and uses account-owned offline replay.
- [x] Add measured personal dishes/recipes to the same basket as catalog foods, preserving independent nutrition snapshots.
- [x] Add quick-add/reused recent foods to mixed baskets using portions of entered totals, without inventing weight. Fractional edits, templates and account-scoped drafts support both measured foods and unknown-weight portions.

Template validation: 58 tests pass, including offline save without diary rows and half-portion reuse. The new form uses the existing saved-meal mutation flow; live-browser and database verification of this entry point now pass.

Personal-dish basket validation: 59 tests pass. Half of a200gserving entered the basket as100g/120cal and saved as Test basket template in the dedicated account. Template confirmation left the draft intact; verification draft then explicitly discarded. Source-dish changes do not alter existing basket snapshots.

Mixed basket validation:60tests, lint, TypeScript and production build pass. Live quick-add240cal at0.5portion restored after reload as120cal and logged; unknown nutrients retained. Next: review draft lifecycle after successful logs and hydration shortcuts/measurement display polish.

- [x] Completed/discarded baskets no longer restore a stale meal time on later visits. Nonempty drafts retain their date/category; empty form choices last only for the current visit. Old empty persisted records are ignored.

Lifecycle validation:61tests, lint, TypeScript and production build pass. Live logger reopened with current20:57time instead of old20:07, with no completed basket restored.

- [x] Basket nutrient preview for protein/carbohydrates/fat/fiber: complete totals, partial known totals and wholly unknown values remain distinct, with missing-food counts. Invalid portion inputs hide the summary and block logging.

Preview validation:62tests, lint, TypeScript and production build pass. Regression covers mixed missing values, explicit zero and portion scaling.

- [x] Dashboard water shortcuts use the account's saved containers and display units, preserving the selected diary day with explicit noon timing for historical entries. Show pending/failure status. Dashboard water totals distinguish unavailable/loading from actual zero.

Hydration validation:63tests, lint, TypeScript and production build pass. Authenticated dashboard Glass shortcut saved250ml on September12at12:00local; linked database verified.

- [x] Dashboard water total and goal use saved ml/US fl oz preference consistently with container shortcuts, with separate total/goal lines for narrow screens.

Mobile dashboard hydration controls inspected at390pxwidth after reload; labels and historical-date note fit. Lint/TypeScript/production build pass; existing63regressions remain applicable (presentation-only change).

- [x] Undo the last dashboard water addition immediately, including a queued offline add/delete sequence. Earlier entries remain untouched; correction failures stay visible for retry.

Undo validation:64tests, lint, TypeScript and production build pass. Live500mlbottle addition/undo restored September12to one250mlentry, verified in linked database.

- [x] Completing a basket log clears only unchanged submitted snapshots, preserving foods added or edited while the request is pending (including another tab's draft edits).

Concurrent-draft validation:65tests, lint, TypeScript and production build pass. Regression covers later additions, edited portions, unchanged serialized snapshots and explicit removal.

- [x] Calendar-selected history includes water in saved units and known fiber totals, with independent loading/error states. Entry counts labelled foods; food-empty days no longer claim nothing at all was logged.
- [x] Expandable keyboard-accessible daily nutrition table accompanies charts with date links, food counts, calories/macros/fiber and recorded target/missing-target values. Decorative chart SVGs no longer obscure table-based access.

History UI verified:September12shows250mlwater,12.5gfiber,4foods; daily table targets distinguish missing snapshot and2100recorded target. Existing65logic regressions apply; lint/TypeScript/build checked.

- [x] History selected dates persist in validated URL parameters, including initial month, refresh and return navigation. Calendar keeps one selected date and rejects future/invalid URLs through shared diary-date validation.

History-date verification:directSeptember12link restored its summary; selectingSeptember11and refreshing retained the selected day and correct diary link. Lint/TypeScript/production build pass; existing65regressions cover shared date parsing.

### Hydration progress — 14 September 2026

- [x] Water-only calendar markers and 30-day daily water totals, entry counts and recorded targets in saved ml/US fl oz units.
- [x] Database aggregation before API row limits; local-day boundaries and account ownership verified with rollback fixtures including 1,001 entries.
- [x] Refresh hydration summaries after water additions, edits and deletions.
- [ ] Review pre-existing Supabase advisor findings (legacy function search paths, vector schema, event-trigger grants and leaked-password protection); the new hydration RPC has no advisor finding.

- [x] Water diary pagination and honest pending/error totals; tracking date carried in URL.

- [x] Food diary loads all entries in stable pages. Logging streak uses local daily aggregates, reads older windows when needed, and avoids raw-entry API truncation or the previous one-year cap.

- [x] Dashboard waits for food/target queries before remaining-progress values; failed loads expose retry and cached-entry context. Missing macro values show known amounts, not precise remaining quantities. Streak badge has an accessible meaning.

- [x] Personal dish search, favorites-only filter and result count; saved-meal search includes ingredient names. Matching handles accents/punctuation/unordered word prefixes. Both libraries read stable pages beyond default row limits.

- [x] Saved-meal deletion undo restores the exact template through the existing ordered offline queue; deletion failures stay visible after the meal card disappears. Undo action is available until leaving the page or deleting another meal.

- [x] Saved-meal preview shows per-food scaled calories and complete/partial/unknown macros and fiber. Preview and logging share scaled snapshots. Fractional diary labels explicitly include the saved-amount multiplier instead of implying the original quantity.

- [x] Direct dish logs snapshot measured grams in the diary label. Repeated recent foods include the multiplier in both direct logging and basket names. Invalid repeat amounts cannot add stale nutrient values to the basket.
