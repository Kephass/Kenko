# Client app — system design

A formal design pass on the one piece of Kenko that's still just a page
list in `SCAFFOLD.md`. Framework used: requirements → high-level design →
deep dive → scale/reliability → trade-offs, with assumptions stated
explicitly rather than baked in silently.

## 1. Requirements

### Functional

- Dashboard: trend weight, rolling 7-day energy balance, today's macros, water progress
- Log a meal: photo capture or typed/voice text → send to `log-meal` → show the draft result for the person to confirm or adjust before it's final
- Log a weigh-in, a body measurement, a water entry - all simple manual forms
- Manage profile/settings (height, birth date, sex, goal, activity multiplier)
- Manage the personal dish library itself - add a new dish, edit an existing recipe, attach a dishware reference photo. **Not previously designed anywhere in this repo** - this document is the first place it's addressed.
- Sign in / sign up (Supabase Auth), since row-level security already supports more than one person
- Installable as a PWA

### Non-functional

- Scale: single person or a handful of independent people, not a high-traffic product - this shapes several decisions below
- Latency: meal-photo logging involves an AI round-trip that can take a few seconds; the UI needs to stay responsive during that window, not block
- Availability: personal tool, occasional downtime is fine, but a failed submit should never silently lose a photo or a typed entry
- Mobile-first: camera access is a core interaction, most usage happens on a phone
- Cross-device: same account, phone and desktop, session persists across both

### Constraints

- Framework already decided (Next.js, per `SCAFFOLD.md`) - this document designs what happens *inside* that choice, not whether to use it
- Backend already built: Supabase Postgres + RLS + pgvector + Storage + Auth, one edge function
- Solo (or near-solo) maintenance - every added dependency or architectural layer has to earn its keep

**Assumption stated up front:** everything below assumes the "personal or small group of independent people" scale from the non-functional requirements. Several recommendations would change if this were actually a multi-thousand-user product - flagged explicitly in the trade-off and "revisit later" sections rather than silently assumed away.

## 2. High-level design

### Component diagram

```
app/
 ├─ layout.tsx            AuthProvider + nav, wraps every route
 ├─ (auth)/login/         public - the only unauthenticated route
 └─ (app)/                everything below requires a session
     ├─ page.tsx           dashboard
     ├─ log/               meal logging
     ├─ weight/            weigh-in log + trend chart
     ├─ measurements/      tape measurement log
     ├─ water/             water log
     ├─ dishes/            personal dish library management  <- new, see above
     └─ settings/          profile

lib/
 ├─ supabase.ts           one client instance, browser-side
 └─ types.ts              generated via `supabase gen types typescript`

hooks/                    one per data type, wraps a React Query hook
 ├─ useWeighIns.ts
 ├─ useMeasurements.ts
 ├─ useWaterLogs.ts
 ├─ useWeeklyBalance.ts
 ├─ useDishes.ts
 └─ useMealLogs.ts
```

### Data flow

Two genuinely different flows, not one:

```
Simple CRUD (weigh-ins, measurements, water, profile, dish library edits)

  component ──► React Query hook ──► supabase-js ──► Postgres (RLS-scoped)
                                                       no edge function involved


Meal logging

  camera/text ──► upload photo to Storage (if photo) ──► POST log-meal
                                                               │
                                                               ▼
                                              draft meal_log row (confirmed=false)
                                                               │
                                                               ▼
                                        shown to the person to confirm/adjust
                                                               │
                                                               ▼
                              direct supabase-js UPDATE (confirmed=true, any edits)
```

The second flow matters: the edge function already inserts the row (see
`log-meal/index.ts`), so the client's "confirm" step is a plain authenticated
`update()` on that same row by id - not a second insert. Worth calling out
because it's easy to accidentally design a client that re-submits the whole
payload instead of just patching the draft.

### API contracts

| Call | Direction | Notes |
|---|---|---|
| `POST /functions/v1/log-meal` | client → edge function | `{ userId, imageBase64?, textInput?, dishwareId? }`, returns the inserted draft row |
| everything else | client → Postgres directly | Supabase's auto-generated REST layer over the schema - no hand-rolled CRUD API needed anywhere else |

### Rendering strategy: client-side, not server components

**Decision:** every authenticated route is client-rendered (`"use client"`),
fetching data in the browser after auth resolves - not Next.js Server
Components with server-side Supabase sessions.

**Why:** Server Components would need `@supabase/ssr`, cookie-based session
handling, and middleware for token refresh - real plumbing for an app that's
entirely behind auth and has no public, SEO-relevant pages to benefit from
server rendering. For a solo-maintained personal tool, that complexity buys
almost nothing here. This is a trade-off, not a free win - made explicit in
section 5.

## 3. Deep dive

### Data model (client-side)

No new tables - generate TypeScript types directly from the live schema
(`supabase gen types typescript --linked > lib/types.ts`) rather than hand-
maintaining a parallel type definition that can silently drift from the
migration file.

### Routing and pages

| Route | Purpose | Primary data need |
|---|---|---|
| `/login` | Auth | Supabase Auth (email/password or magic link) |
| `/` | Dashboard | `weekly_energy_balance()`, latest trend weight, today's `meal_logs` sum, today's `water_logs` sum |
| `/log` | Meal logging | `log-meal` edge function, then a direct update to confirm |
| `/weight` | Weigh-ins | `weigh_ins`, chart of raw vs. trend weight |
| `/measurements` | Tape measurements | `measurements` |
| `/water` | Water | `water_logs` |
| `/dishes` | Dish library management | `dishes`, `dish_ingredients`, `dishware` |
| `/settings` | Profile | `user_profile` |

Suggested build order stays as `SCAFFOLD.md` already has it, with `/dishes`
slotted in before `/log` - logging against an empty dish library isn't very
useful, so populating it needs its own screen before the logging flow is
worth testing end to end.

### State management

- **Server state** (basically everything: weigh-ins, logs, dishes, balance):
  React Query. One dependency, in exchange for shared caching, loading/error
  states, and mutation-triggered invalidation across six-plus independent
  data types, instead of six-plus hand-rolled `useEffect` fetches.
- **Local UI state** (form inputs, camera capture state, the confirm/edit
  screen for a draft meal log): plain `useState`/`useReducer`, per component.
- **No global state library.** Redux/Zustand would be solving a problem this
  app doesn't have - almost nothing here is client-only state that needs to
  be shared across distant parts of the tree.

### Auth flow

A thin `AuthProvider` in the root layout wraps
`supabase.auth.onAuthStateChange`, exposes the session via context,
redirects to `/login` when absent. Nothing more elaborate is needed at this
scale - no server-side session, no refresh-token middleware.

### Caching strategy

| Query | Suggested `staleTime` | Why |
|---|---|---|
| `weekly_energy_balance()` | ~30-60s | Changes with every new meal log, but doesn't need to be instantaneous |
| today's macro/water totals | ~30-60s | Same reasoning |
| trend weight history | a few minutes | Changes at most once a day |
| dish library | several minutes | Changes rarely, invalidate explicitly on dish create/edit |

Invalidate the relevant queries after each mutation (e.g. confirming a meal
log invalidates the weekly-balance and today's-macros queries) rather than
relying on time-based staleness alone.

### Error handling and retry logic

- If the `log-meal` request fails outright (network error, provider
  timeout), keep the captured photo/text in local component state and show
  a retry action - this is the "local draft, not a lost submission" safety
  net from the earlier architecture discussion, made concrete here.
- Don't auto-retry the `log-meal` mutation silently - an AI call that
  actually succeeded but whose response got lost over a flaky connection
  would create a duplicate log if blindly retried. Surface the failure,
  let the person explicitly retry.
- Simple direct-to-Postgres writes (weigh-ins, water, measurements) can use
  React Query's default retry-with-backoff safely, since these aren't
  paying for an AI call each time.
- An abandoned confirm screen leaves a `confirmed=false` row sitting in
  `meal_logs` - harmless, but worth a small "discard" action on that screen
  rather than letting these silently accumulate.

## 4. Scale and reliability

Mostly not applicable, and worth saying so plainly rather than manufacturing
scale concerns that don't exist yet: a handful of people, a few dozen
requests a day each. Vercel and Supabase both scale far past that without
any custom work. The one genuinely useful addition at this scale: a small
"AI usage this month" view on `/settings`, reading the `ai_call_log` table
that already exists in the schema - cheap to build, and it's the one place
a bug (a retry loop, say) would actually show up before it shows up as a
surprise bill.

## 5. Trade-off analysis

| Decision | Chosen | Trade-off |
|---|---|---|
| Rendering | Client-side, not Server Components | Simpler auth, no session/cookie plumbing, at the cost of a slightly heavier client bundle and no SSR benefits - irrelevant here since nothing is public/SEO-relevant |
| Data fetching | React Query | One dependency and a small learning curve, in exchange for consistent caching/loading/error handling across many independent data types |
| Global state | None | Would add structure a genuinely large app might want; this app's state is almost entirely server state, so it would be complexity without a matching problem |
| Photo handling | Upload to Storage, then reference by URL | An extra round-trip before the AI call, in exchange for the photo persisting - which the calibration loop and dishware-comparison features (both already planned) require. Sending base64 straight through would be marginally faster but throws away data two planned features need |
| Confirm flow | Edge function inserts immediately (`confirmed=false`); client patches on confirm | Simpler than reconstructing a full insert client-side, at the cost of abandoned draft rows needing a small cleanup affordance |

## What I'd revisit as this grows

- If this genuinely becomes multi-user at any real scale (not just "RLS
  supports it" but actual concurrent independent people), Server Components
  and proper session middleware start earning their complexity - revisit
  the rendering decision then, not now.
- If offline logging becomes a real recurring pain point rather than a rare
  edge case, revisit "online-only plus a local draft" toward genuine
  offline-first sync.
- If the dish library grows large or ever becomes shared across users, the
  pgvector index type/parameters may need tuning beyond the current default.
- If `log-meal` latency becomes annoying, worth reconsidering whether
  logging should be fire-and-forget with a notification on completion,
  rather than a screen the person waits on.
