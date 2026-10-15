"""Build the curated West/Central African home-cooking catalog.
Usage: python3 scripts/build-african-dishes.py
Writes client/src/data/african-dishes.json (CatalogFood[]).

These are community nutrition ESTIMATES per 100 g edible, cooked portion.
Home recipes vary widely; every entry is flagged estimated=true and the user
reviews and edits totals before logging. Grams are weight, not millilitres.
No USDA record is claimed for these finished dishes.
"""
import json, re, unicodedata
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "african-dishes.json"

# (name, category, calories, protein, carbs, fat, fiber, portion_label, portion_g, description)
# Nutrition is per 100 g cooked edible portion. None = unknown (stays null).
D = [
    # ------------------------------ Ghana: staples / swallow ------------------------------
    ("Jollof rice", "Ghanaian", 150, 3.0, 25.0, 4.5, 1.2, "1 plate", 250,
     "Rice cooked in a tomato, onion, pepper and spice base with oil. Often served with chicken, fish or salad (counted separately)."),
    ("Waakye", "Ghanaian", 140, 5.0, 25.0, 2.0, 3.5, "1 plate", 250,
     "Rice and cowpeas boiled with dried sorghum leaves. Plain base; stew, gari, egg and spaghetti are logged separately."),
    ("Banku", "Ghanaian", 150, 2.5, 33.0, 0.6, 1.5, "1 ball", 200,
     "Fermented corn and cassava dough cooked to a smooth, slightly sour swallow. Served with soup, stew or pepper."),
    ("Kenkey", "Ghanaian", 160, 3.0, 34.0, 1.0, 2.0, "1 ball", 200,
     "Fermented corn dough wrapped and boiled (Ga or Fante style). Eaten with pepper sauce, fish or stew."),
    ("Fufu", "Ghanaian", 130, 1.0, 31.0, 0.2, 1.8, "1 serving", 250,
     "Pounded cassava and plantain (or cocoyam) swallow. Served in soup; the soup is logged separately."),
    ("Tuo Zaafi (TZ)", "Ghanaian", 110, 2.0, 25.0, 0.3, 1.0, "1 serving", 250,
     "Northern maize (and cassava/millet) swallow cooked soft. Served with ayoyo or green leaf soup."),
    ("Omo tuo (rice balls)", "Ghanaian", 130, 2.5, 28.0, 0.3, 0.6, "3 balls", 250,
     "Soft mashed rice shaped into balls, served with groundnut or palm nut soup."),
    ("Kokonte", "Ghanaian", 140, 1.0, 34.0, 0.2, 1.6, "1 serving", 200,
     "Swallow from dried cassava flour (face-the-wall). Served with groundnut or palm nut soup."),
    ("Boiled yam", "Ghanaian", 118, 1.5, 28.0, 0.2, 4.0, "1 serving", 250,
     "Plain boiled yam. Eaten with garden egg stew, kontomire or palava sauce."),
    ("Ampesi", "Ghanaian", 125, 1.6, 29.0, 0.3, 3.8, "1 serving", 250,
     "Boiled yam, plantain and/or cocoyam served with a stew or kontomire."),
    ("Fried yam", "Ghanaian", 190, 2.0, 30.0, 7.0, 3.5, "1 serving", 200,
     "Yam boiled then deep-fried. Street food, usually with shito or pepper."),
    ("Boiled plantain", "Ghanaian", 122, 1.3, 32.0, 0.4, 2.3, "1 serving", 200,
     "Ripe or green plantain boiled. Eaten with beans stew, kontomire or garden egg."),
    ("Kelewele", "Ghanaian", 210, 1.5, 35.0, 8.0, 2.5, "1 serving", 120,
     "Ripe plantain cubes spiced with ginger, pepper and nutmeg, then deep-fried."),
    ("Fried ripe plantain", "Ghanaian", 190, 1.5, 30.0, 7.0, 2.3, "1 serving", 150,
     "Ripe plantain slices shallow- or deep-fried (unspiced). The side known as 'kelewele' when spiced."),
    ("Tatale", "Ghanaian", 220, 3.0, 32.0, 9.0, 2.5, "2 pieces", 100,
     "Overripe plantain mashed with onion, flour and spice, fried as pancakes. Served with aboboi."),
    ("Kaklo", "Ghanaian", 230, 2.5, 34.0, 10.0, 2.2, "3 balls", 100,
     "Spiced ripe-plantain batter fried into small balls."),
    ("Gari", "Ghanaian", 357, 1.5, 85.0, 0.5, 3.6, "1 handful (dry)", 40,
     "Dry roasted cassava granules. Sprinkled over waakye/beans or soaked. Dry weight — soaks up water."),
    ("Gari soakings", "Ghanaian", 180, 4.0, 32.0, 4.0, 2.0, "1 bowl", 250,
     "Gari soaked in water with sugar, milk and roasted groundnuts. Varies widely with add-ins."),

    # ------------------------------ Ghana: soups & stews ------------------------------
    ("Groundnut soup", "Ghanaian", 120, 6.0, 6.0, 8.0, 1.5, "1 bowl", 300,
     "Peanut-paste soup with tomato, onion and meat or fish. Served with fufu, omo tuo or rice balls."),
    ("Palm nut soup (Abenkwan)", "Ghanaian", 135, 5.0, 4.0, 11.0, 1.5, "1 bowl", 300,
     "Soup from palm-fruit pulp with meat, fish and aromatics. Rich in palm oil."),
    ("Light soup", "Ghanaian", 55, 6.0, 3.0, 2.0, 0.8, "1 bowl", 300,
     "Clear tomato-pepper broth with goat, chicken or fish. Served with fufu or rice balls."),
    ("Egusi soup", "Ghanaian", 200, 9.0, 7.0, 16.0, 3.0, "1 bowl", 250,
     "Ground melon seed soup with greens, palm oil and meat or fish."),
    ("Okro soup", "Ghanaian", 90, 4.0, 6.0, 5.0, 2.5, "1 bowl", 300,
     "Okra soup with palm oil, meat and fish, sometimes with greens. Also made as okro stew."),
    ("Kontomire stew (palava sauce)", "Ghanaian", 180, 7.0, 6.0, 14.0, 3.0, "1 serving", 150,
     "Cocoyam leaves with egusi, palm oil, onion and fish or meat. Served with yam or plantain."),
    ("Garden egg stew", "Ghanaian", 120, 2.5, 7.0, 9.0, 2.5, "1 serving", 150,
     "African eggplant simmered with onion, tomato, pepper and oil, often with fish."),
    ("Nkontomire (steamed cocoyam leaves)", "Ghanaian", 70, 4.0, 6.0, 3.0, 3.5, "1 serving", 150,
     "Steamed, chopped cocoyam leaves lightly dressed. Base for palava sauce."),
    ("Tomato stew", "Ghanaian", 150, 3.0, 8.0, 11.0, 1.8, "1 serving", 120,
     "Blended tomato, onion and pepper fried in oil with meat or fish. The all-purpose stew for rice and yam."),
    ("Fante fante (fish stew)", "Ghanaian", 140, 10.0, 5.0, 9.0, 1.0, "1 serving", 200,
     "Fresh fish stewed in palm oil with tomato, pepper and herbs (Fante 'fante fante')."),
    ("Shito", "Ghanaian", 350, 6.0, 12.0, 30.0, 3.0, "1 tbsp", 20,
     "Dark pepper sauce of dried fish/shrimp, chilli, onion and oil. Condiment — small amounts."),

    # ------------------------------ Ghana: beans & pottage ------------------------------
    ("Red red", "Ghanaian", 150, 6.0, 18.0, 6.0, 5.0, "1 serving", 250,
     "Black-eyed pea stew cooked in palm oil with tomato. Served with fried plantain (logged separately)."),
    ("Aboboi (bambara beans stew)", "Ghanaian", 130, 8.0, 18.0, 2.5, 6.0, "1 bowl", 250,
     "Bambara groundnut stew, traditionally eaten with tatale."),
    ("Yor ke gari", "Ghanaian", 160, 6.0, 28.0, 3.0, 5.0, "1 serving", 250,
     "Cowpeas cooked and mixed with gari and palm oil (beans and gari)."),
    ("Gob3 (beans and gari)", "Ghanaian", 170, 6.0, 25.0, 5.0, 5.0, "1 serving", 250,
     "Street plate of beans with gari, fried plantain, oil and pepper (also called gobe)."),
    ("Mpotompoto (yam pottage)", "Ghanaian", 110, 2.5, 18.0, 3.0, 2.0, "1 bowl", 300,
     "Mashed yam or cocoyam cooked soft with tomato, onion and oil. Common weaning and comfort food."),
    ("Etor (mashed plantain)", "Ghanaian", 200, 4.0, 28.0, 8.0, 2.5, "1 serving", 200,
     "Mashed ripe plantain or yam with palm oil, often served with boiled egg and groundnuts."),

    # ------------------------------ Ghana: rice & pasta dishes ------------------------------
    ("Ghana fried rice", "Ghanaian", 180, 4.5, 26.0, 6.0, 1.2, "1 plate", 250,
     "Rice stir-fried with vegetables, egg and seasoning. Usually with chicken or shito."),
    ("Jollof spaghetti", "Ghanaian", 160, 4.5, 27.0, 4.0, 1.5, "1 plate", 250,
     "Spaghetti cooked in a jollof-style tomato-pepper sauce."),
    ("Angwamu (oily rice)", "Ghanaian", 190, 3.0, 28.0, 7.5, 0.8, "1 plate", 250,
     "Rice cooked with oil and often black-eyed peas; sometimes called 'oily rice'."),
    ("Plain white rice", "Ghanaian", 130, 2.7, 28.0, 0.3, 0.4, "1 plate", 250,
     "Boiled or steamed white rice, the base for stew, soup or sauce."),

    # ------------------------------ Ghana: porridges & breakfast ------------------------------
    ("Koko (corn porridge)", "Ghanaian", 60, 1.5, 12.0, 0.5, 0.8, "1 bowl", 300,
     "Fermented corn porridge, smooth and slightly sour. Breakfast with koose or bread."),
    ("Hausa koko", "Ghanaian", 65, 2.0, 13.0, 0.6, 1.0, "1 bowl", 300,
     "Spiced millet porridge with ginger, pepper and cloves. Breakfast staple."),
    ("Tom brown", "Ghanaian", 90, 3.0, 16.0, 1.5, 2.0, "1 bowl", 300,
     "Porridge of roasted, milled grains (maize/soya/groundnut). Often for children."),
    ("Rice water", "Ghanaian", 55, 1.0, 12.0, 0.3, 0.3, "1 bowl", 300,
     "Thin rice porridge, usually sweetened with milk and sugar. Breakfast."),
    ("Oblayo (corn porridge)", "Ghanaian", 70, 1.8, 14.0, 0.8, 0.8, "1 bowl", 300,
     "Sweetened roasted-corn porridge, lighter than koko."),

    # ------------------------------ Ghana: street food & snacks ------------------------------
    ("Bofrot (puff puff)", "Ghanaian", 310, 5.0, 40.0, 14.0, 1.5, "2 balls", 60,
     "Sweet deep-fried dough balls (bofrot / togbei). Snack with tea or koko."),
    ("Koose (bean cakes)", "Ghanaian", 210, 8.0, 18.0, 12.0, 4.0, "3 pieces", 80,
     "Fried spiced black-eyed pea fritters (akara). Breakfast with koko or bread."),
    ("Suya / Chinchinga", "Ghanaian", 230, 26.0, 3.0, 13.0, 1.0, "1 stick", 100,
     "Grilled beef skewers coated in spiced groundnut 'suya' rub. Street grill."),
    ("Khebab (beef kebab)", "Ghanaian", 220, 25.0, 2.0, 13.0, 0.6, "1 stick", 90,
     "Skewered grilled beef with pepper spice; leaner or fattier by cut."),
    ("Meat pie", "Ghanaian", 300, 8.0, 28.0, 18.0, 1.5, "1 pie", 120,
     "Flaky pastry filled with minced beef, onion and potato. Pastry snack."),
    ("Spring rolls", "Ghanaian", 250, 6.0, 28.0, 12.0, 1.8, "2 rolls", 90,
     "Fried wrappers with vegetable and sometimes meat filling. Party and street snack."),
    ("Chofi (grilled tilapia)", "Ghanaian", 150, 22.0, 0.0, 7.0, 0.0, "1 serving", 200,
     "Whole grilled tilapia, usually served with banku and pepper (pepper logged separately)."),
    ("Nkate cake", "Ghanaian", 480, 18.0, 45.0, 27.0, 5.0, "1 bar", 40,
     "Peanut brittle of roasted groundnuts set in caramelised sugar. Dense snack."),
    ("Toffee (coconut candy)", "Ghanaian", 430, 4.0, 55.0, 23.0, 5.0, "2 pieces", 30,
     "Caramelised coconut candy sold by the roadside."),
    ("Atwemo (chin chin)", "Ghanaian", 470, 8.0, 55.0, 24.0, 1.8, "1 handful", 50,
     "Crunchy fried sweet dough strips. Snack, stores well."),

    # ------------------------------ Ghana: drinks ------------------------------
    ("Sobolo", "Ghanaian", 40, 0.2, 10.0, 0.0, 0.2, "1 glass", 250,
     "Hibiscus (bissap) drink with ginger and spices, usually sweetened. Grams ≈ millilitres here but logged by weight."),
    ("Asaana", "Ghanaian", 60, 0.8, 14.0, 0.3, 0.3, "1 glass", 250,
     "Drink from fermented, caramelised corn, sweetened. Served chilled."),
    ("Lamugin", "Ghanaian", 45, 0.3, 11.0, 0.1, 0.2, "1 glass", 250,
     "Spiced ginger drink, sweetened (lamugine). Refreshing and sharp."),
    ("Brukina", "Ghanaian", 110, 4.0, 18.0, 2.5, 0.6, "1 cup", 250,
     "Fermented milk with milled millet (burkina/degue), sweetened."),

    # ------------------------------ Angola & Central Africa ------------------------------
    ("Funge (cassava)", "Angolan", 110, 0.6, 27.0, 0.2, 1.0, "1 serving", 250,
     "Smooth cassava-flour swallow (funje). Base for Angolan stews and fish."),
    ("Funge de milho", "Angolan", 115, 2.0, 25.0, 0.5, 1.2, "1 serving", 250,
     "Maize-flour version of funge, served with muamba or calulu."),
    ("Pirão", "Angolan", 100, 0.6, 24.0, 0.2, 0.8, "1 serving", 250,
     "Soft cassava-flour porridge thickened in broth, served alongside fish or meat."),
    ("Muamba de galinha", "Angolan", 180, 12.0, 4.0, 13.0, 1.5, "1 serving", 250,
     "Chicken stewed in palm oil (dendê) with okra, garlic and chilli. National dish."),
    ("Muamba de ginguba", "Angolan", 190, 13.0, 7.0, 12.0, 1.5, "1 serving", 250,
     "Chicken or meat in a groundnut (peanut) sauce. Rich and nutty."),
    ("Calulu", "Angolan", 160, 12.0, 6.0, 10.0, 3.0, "1 serving", 250,
     "Fresh and dried fish (or meat) with sweet potato leaves, okra and palm oil."),
    ("Kizaka (cassava leaves)", "Angolan", 150, 6.0, 8.0, 11.0, 4.0, "1 serving", 150,
     "Pounded cassava leaves cooked with palm oil and groundnut paste (quizaca)."),
    ("Feijão de óleo de palma", "Angolan", 160, 7.0, 18.0, 7.0, 6.0, "1 serving", 250,
     "Beans stewed in palm oil with onion and garlic. Everyday Angolan plate."),
    ("Mufete (grilled fish)", "Angolan", 150, 22.0, 0.0, 7.0, 0.0, "1 serving", 200,
     "Charcoal-grilled fish, classically served with beans, cassava, sweet potato and palm-oil onion sauce (sides separate)."),
    ("Cabidela", "Angolan", 170, 15.0, 3.0, 11.0, 0.5, "1 serving", 250,
     "Chicken cooked in its own seasoned blood with vinegar and spices (moela/cabidela)."),
    ("Doce de ginguba", "Angolan", 470, 16.0, 45.0, 26.0, 5.0, "1 piece", 40,
     "Peanut sweet / brittle, caramelised roasted groundnuts. Dense treat."),
    ("Cocada amarela", "Angolan", 330, 4.0, 48.0, 14.0, 4.0, "1 serving", 120,
     "Golden coconut pudding with egg yolk and sugar. Dessert of Portuguese heritage."),
    ("Quitetas (clam stew)", "Angolan", 110, 14.0, 4.0, 4.0, 0.5, "1 serving", 200,
     "Small clams stewed with onion, tomato, garlic and coriander."),
]


def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


def main():
    rows = []
    seen = set()
    for name, cat, cal, p, c, f, fib, plabel, pg, desc in D:
        prefix = "gh" if cat == "Ghanaian" else "ao"
        _id = f"kenko-{prefix}-{slug(name)}"
        if _id in seen:
            raise ValueError(f"duplicate id {_id}")
        seen.add(_id)
        rows.append({
            "id": _id,
            "name": name,
            "category": cat,
            "nutrition": {"calories": cal, "protein": p, "carbs": c, "fat": f, "fiber": fib},
            "portions": [{"label": plabel, "grams": pg}],
            "estimated": True,
            "recipe": f"{desc} Community nutrition estimate per 100 g cooked edible portion; home recipes vary, so review and edit before logging.",
        })
    rows.sort(key=lambda r: (r["category"], r["name"]))
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")
    gh = sum(1 for r in rows if r["category"] == "Ghanaian")
    ao = sum(1 for r in rows if r["category"] == "Angolan")
    print(f"wrote {len(rows)} dishes ({gh} Ghanaian, {ao} Angolan) to {OUT}")


if __name__ == "__main__":
    main()
