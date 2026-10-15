# Food catalog provenance

USDA FoodData Central SR Legacy, April 2018 final release. Public-domain nutrition/reference serving weights; downloaded 13 September 2026.

https://fdc.nal.usda.gov/download-datasets/
https://fdc.nal.usda.gov/api-guide/

Archive SHA256: 0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef

Contains 3195 entries from selected source categories, including raw/cooked/canned variants. This is broad reference coverage, not every food or every fruit/vegetable worldwide. Values are per 100 g edible portion; source portion labels retain measured gram weights. Missing nutrients stay null. Calories use nutrient 1008 (kcal), never kJ or calories calculated from macros; alcohol energy is therefore retained.

Cocktails and prepared meals are marked estimates because recipes vary. Kenko mocktails are example recipes calculated by ingredient weight with explicit FDC ingredient IDs; exclude ice and garnish. They are not official USDA finished-drink records. Gram weights must not be interpreted as ml. Users can review/edit totals before logging.

Regenerate using client/scripts/import-catalog.py and the official ZIP; no runtime API key or database migration is needed.
