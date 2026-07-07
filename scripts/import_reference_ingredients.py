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
