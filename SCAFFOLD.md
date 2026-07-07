# Scaffolding Kenko

This is the build checklist: what to physically stand up, in what order, to
go from the current repo state to a working end-to-end app. `README.md` is
how to run what already exists; `PROJECT.md` is what and why; this is how to
build the rest.

## Target structure

```
kenko/
├── README.md                                   done
├── PROJECT.md                                  done
├── SCAFFOLD.md                                 done (this file)
├── .env.example                                done
├── .gitignore                                  done
├── supabase/
│   ├── migrations/
│   │   └── 20260707120000_initial_schema.sql   done
│   └── functions/
│       └── log-meal/
│           └── index.ts                        branching logic done, AI providers stubbed
├── scripts/                                    to scaffold - offline tooling (Python)
│   ├── requirements.txt
│   ├── import_reference_ingredients.py         loads a food composition table into wafct_ingredients
│   ├── generate_dish_embeddings.py             embeds your dish library, writes to dishes.embedding
│   └── bakeoff.py                              scores AI providers on your own labeled meal photos
└── client/                                     to scaffold - the PWA
    ├── package.json
    ├── next.config.js
    ├── public/
    │   ├── manifest.json
    │   └── icons/
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx                        dashboard: trend, weekly balance, macros at a glance
        │   ├── log/page.tsx                    meal logging - camera + text input
        │   ├── weight/page.tsx
        │   ├── measurements/page.tsx
        │   ├── water/page.tsx
        │   └── settings/page.tsx               profile: height, birth date, sex, goal
        ├── components/
        ├── lib/
        │   └── supabase.ts                     one shared client instance
        └── hooks/                              useWeighIns, useMealLogs, useWeeklyBalance, etc.
```

## Prerequisites

- Node.js LTS + pnpm
- Python 3.11+
- The Supabase CLI (`pnpm add -g supabase`)
- git, and this repo cloned locally

## Step 1 — Supabase project (skip if already done)

Covered in `README.md`: `supabase login`, `supabase link --project-ref <ref>`,
`supabase db push`. Confirm `select * from dishes limit 1;` runs in the
Supabase SQL editor before moving on - that's your signal the schema is live.

## Step 2 — `scripts/`: offline tooling

```bash
mkdir -p scripts
cd scripts
python3 -m venv .venv && source .venv/bin/activate
pip install pandas psycopg2-binary python-dotenv openpyxl
```

`requirements.txt`:
```
pandas
psycopg2-binary
python-dotenv
openpyxl
```

`import_reference_ingredients.py` - skeleton:
```python
"""
Loads a food composition table (WAFCT, USDA, TACO, etc.) into
wafct_ingredients. Point INPUT_PATH at whatever spreadsheet actually covers
your cuisine - the table structure doesn't care which one you use.
"""
import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()
INPUT_PATH = "wafct_2019.xlsx"  # TODO: point at your actual source file

def main():
    df = pd.read_excel(INPUT_PATH)
    # TODO: map source columns to (food_code, name_en, name_fr,
    # calories_per_100g, protein_g_per_100g, carbs_g_per_100g,
    # fat_g_per_100g, fiber_g_per_100g) - exact column names depend on
    # which source table you're using.
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    with conn.cursor() as cur:
        for _, row in df.iterrows():
            cur.execute(
                """
                insert into wafct_ingredients
                    (food_code, name_en, calories_per_100g, protein_g_per_100g,
                     carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (food_code) do update set
                    calories_per_100g = excluded.calories_per_100g
                """,
                (row["food_code"], row["name_en"], row["calories"],
                 row["protein"], row["carbs"], row["fat"], row["fiber"]),
            )
    conn.commit()
    print(f"loaded {len(df)} ingredients")

if __name__ == "__main__":
    main()
```

`generate_dish_embeddings.py` and `bakeoff.py` are genuinely blocked on one
decision - which embedding/vision provider your bake-off picks - so they're
listed here as placeholders rather than skeletons. Worth writing `bakeoff.py`
first: run 2-3 candidate providers against ~15-20 of your own meal photos
(ideally ones you've also weighed) and score identification accuracy before
building anything that depends on the winner.

## Step 3 — `client/`: the PWA

See [CLIENT_DESIGN.md](./CLIENT_DESIGN.md) for the full routing, state, and
data-flow design behind what follows - this section stays purely mechanical.

```bash
pnpm create next-app@latest client --typescript --tailwind --app --import-alias "@/*"
cd client
pnpm add @supabase/supabase-js
# For offline support later, use @serwist/turbopack - next-pwa is
# webpack-only and does nothing under Next 16's Turbopack builds.
```

`src/lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

`public/manifest.json`:
```json
{
  "name": "Kenko",
  "short_name": "Kenko",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Page-by-page build order, roughly easiest-to-hardest:
1. `settings/page.tsx` - profile form (writes to `user_profile`), needed before BMR-dependent numbers make sense anywhere else
2. `weight/page.tsx` - log a weigh-in, chart raw vs. trend weight
3. `water/page.tsx` and `measurements/page.tsx` - simple logging forms
4. `page.tsx` (dashboard) - pulls `weekly_energy_balance()`, latest trend weight, today's macros
5. `log/page.tsx` - the meal logging flow (camera capture → POST to `log-meal` → show result for confirmation). Build this last; it's the one page that depends on the edge function's AI providers actually being wired up.

## Step 4 — environment variables

`client/.env.local` (not committed):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Note this is the publishable key (sb_publishable_..., successor to the
legacy anon key) - the client should only ever hold this key, protected by
RLS. The service role key stays server-side in the edge function's secrets,
never in client code.

## Checklist

- [x] Supabase linked, migration applied, confirmed live in SQL editor
- [ ] `scripts/` venv set up, `import_reference_ingredients.py` run against a real source table
- [ ] `bakeoff.py` run, provider decided
- [ ] `log-meal/index.ts` providers wired in (back in the main repo, not here)
- [ ] `generate_dish_embeddings.py` run against an initial ~15-dish library
- [ ] `client/` scaffolded, `settings` and `weight` pages working end to end
- [ ] `water` and `measurements` pages working
- [ ] Dashboard page working
- [ ] `log` page working - full pipeline, camera to confirmed log entry
