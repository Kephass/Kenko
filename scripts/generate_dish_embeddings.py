"""
PLACEHOLDER - blocked on the provider decision from bakeoff.py.

Embeds your personal dish library (an initial ~15 dishes) with the chosen
embedding model and writes the vectors to dishes.embedding, so the log-meal
edge function's pgvector similarity search has something to match against.

Once bakeoff.py picks a provider:
  1. Confirm dishes.embedding's dimension matches the chosen model
     (the migration defaults to vector(768) - change it there if not).
  2. For each row in dishes (per user), embed a reference photo and/or the
     dish name, and UPDATE dishes SET embedding = ... WHERE id = ...
  3. Use SUPABASE_DB_URL from .env, same as import_reference_ingredients.py.
"""

raise SystemExit("generate_dish_embeddings.py is a placeholder - see the module docstring.")
