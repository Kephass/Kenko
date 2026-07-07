"""
PLACEHOLDER - write this one first (see SCAFFOLD.md, step 2).

Scores 2-3 candidate AI providers against ~15-20 of your own labeled meal
photos (ideally ones you've also weighed) and reports identification
accuracy, so the provider decision is based on YOUR dishes, not a public
benchmark.

Blocked on: choosing which candidate providers to test. Once decided:
  1. Put labeled photos in a local folder: <dish-name>__<grams>.jpg
  2. For each provider, run identification over every photo.
  3. Report per-provider accuracy (and cost per call).

The winner gets wired into supabase/functions/log-meal/index.ts
(embedMealPhoto / reasonOverUnfamiliarDish) and decides the embedding
dimension in the schema (dishes.embedding, currently vector(768)).
"""

raise SystemExit("bakeoff.py is a placeholder - see the module docstring.")
