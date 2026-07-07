# Kenko

A personal nutrition and body-tracking app built for people whose food isn't
in the databases the big apps use. It started as a DIY WeightWatchers
alternative for Ghanaian and Angolan cuisine, and the underlying approach -
a small personal dish library instead of a generic global food database -
works for anyone whose cuisine is underserved by mainstream tracking apps.

For the full picture - feature set, architecture, data model, and how to
adapt this for a different cuisine or a different person - see
[PROJECT.md](./PROJECT.md). For the ordered checklist to build out
everything not yet built (the client app, the offline tooling scripts), see
[SCAFFOLD.md](./SCAFFOLD.md). This file is just quick start.

## Repo layout

```
.
├── PROJECT.md                                  <- full write-up: features, architecture, data model
├── supabase/
│   ├── migrations/
│   │   └── 20260707120000_initial_schema.sql   <- schema, tested against Postgres 16 + pgvector 0.6
│   └── functions/
│       └── log-meal/
│           └── index.ts                        <- meal-logging pipeline (still being finalized)
├── .env.example
└── .gitignore
```

## Quick start

```bash
# 1. Install the Supabase CLI if you haven't already
pnpm add -g supabase

# 2. Link this repo to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# 3. Apply the migration
supabase db push

# 4. Set secrets the edge function needs
supabase secrets set AI_PROVIDER_API_KEY=sk-...

# 5. Deploy the edge function
supabase functions deploy log-meal
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
into edge functions by Supabase - you don't set those yourself. `.env.example`
lists them for local testing with `supabase functions serve`.

## Status

Schema and core calculation functions (body-fat estimate, BMR, weight trend,
rolling energy balance, dish matching) are built and tested. The meal-logging
edge function has its branching logic in place but its AI provider calls are
still placeholders - see [PROJECT.md](./PROJECT.md#status--roadmap) for the
full breakdown of what's done, what's stubbed, and what's next.

## License

Not yet decided. If you're adapting this for your own use, pick one that
suits you - MIT is a reasonable default for something like this.
