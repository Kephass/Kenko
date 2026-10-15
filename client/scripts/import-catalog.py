"""Build the offline catalog from the official USDA SR Legacy April 2018 JSON ZIP.
Usage: python3 scripts/import-catalog.py /path/to/download.zip
Download: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
No raw archive, keys or user data are committed.
"""
import json,zipfile,sys,hashlib,collections
from pathlib import Path
archive=Path(sys.argv[1]); z=zipfile.ZipFile(archive)
foods=json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json'))))['SRLegacyFoods']
groups={'Fruits and Fruit Juices':'Fruits','Vegetables and Vegetable Products':'Vegetables','Legumes and Legume Products':'Beans & legumes','Beverages':'Drinks','Meals, Entrees, and Side Dishes':'Meals','Fast Foods':'Meals','Restaurant Foods':'Meals','Soups, Sauces, and Gravies':'Meals','Cereal Grains and Pasta':'Grains','Dairy and Egg Products':'Dairy & eggs','Nut and Seed Products':'Nuts & seeds'}
rows=[]; by_id={r['fdcId']:r for r in foods}
nutrient_ids={'calories':1008,'protein':1003,'carbs':1005,'fat':1004,'fiber':1079}
def nutrition(r):
 n={x['nutrient']['id']:x.get('amount') for x in r['foodNutrients']}
 return {k:n.get(v) for k,v in nutrient_ids.items()}
for r in foods:
 cat=groups.get(r.get('foodCategory',{}).get('description'))
 if not cat: continue
 n=nutrition(r)
 if n['calories'] is None: continue
 name=r['description']
 if cat=='Fruits' and 'juice' in name.lower() and 'raw' not in name.lower():cat='Drinks'
 if cat=='Drinks' and any(t in name.lower() for t in ['pina colada','tequila sunrise','daiquiri','whiskey sour','margarita','gin and tonic']):cat='Cocktails'
 portions=[]
 for p in sorted(r.get('foodPortions',[]),key=lambda p:p.get('sequenceNumber',0)):
  if p.get('gramWeight',0)>0 and p.get('amount',0)>0:
   portions.append({'label':f"{p['amount']:g} {p.get('modifier','portion')}", 'grams':p['gramWeight']})
 rows.append({'id':str(r['fdcId']),'name':name,'category':cat,'nutrition':n,'portions':portions[:6],'estimated':cat in ['Cocktails','Meals']})
# Kenko example recipes, all ingredient amounts by weight, excluding ice/garnishes.
# Nutrition is calculated from the listed USDA ingredient records, not an official recipe rating.
recipes=[('Sparkling lime mocktail',[(168156,30),(174842,200)],'Tart, unsweetened lime and soda.'),('Sparkling lemonade mocktail',[(167747,30),(174842,200)],'Unsweetened lemon and soda.')]
# Find exact generic juice/sugar records so provenance remains reproducible.
def find(name):
 matches=[r for r in foods if r['description'].lower()==name.lower()]
 if len(matches)!=1:raise ValueError(name)
 return matches[0]['fdcId']
sugar=find('Sugars, granulated');orange=169098
recipes += [('Lime cooler mocktail',[(168156,30),(174842,180),(sugar,10)],'Lightly sweetened lime soda.'),('Orange spritz mocktail',[(orange,120),(174842,120),(168156,15)],'Orange juice, soda and lime.'),('Citrus punch mocktail',[(orange,150),(167747,20),(sugar,10),(174842,100)],'Sweet orange and lemon punch.')]
for i,(name,ingredients,note) in enumerate(recipes):
 weight=sum(g for _,g in ingredients)
 totals={k:None if any(nutrition(by_id[f])[k] is None for f,g in ingredients) else round(sum(nutrition(by_id[f])[k]*g/100 for f,g in ingredients)*100/weight,6) for k in nutrient_ids}
 rows.append({'id':f'kenko-mocktail-{i+1}','name':name,'category':'Mocktails','nutrition':totals,'portions':[{'label':'1 prepared drink (without ice)','grams':weight}],'estimated':True,'recipe':note+' '+ '; '.join(f"{g} g {by_id[f]['description']} (FDC {f})" for f,g in ingredients)})
rows.sort(key=lambda r:(r['category'],r['name'].lower()))
out=Path(__file__).resolve().parents[1]/'src/data/food-catalog.json'
out.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
print(len(rows),dict(collections.Counter(r['category'] for r in rows)),out.stat().st_size)
(out.parent/'CATALOG-SOURCES.md').write_text(f'''# Food catalog provenance\n\nUSDA FoodData Central SR Legacy, April 2018 final release. Public-domain nutrition/reference serving weights; downloaded 13 September 2026.\n\nhttps://fdc.nal.usda.gov/download-datasets/\nhttps://fdc.nal.usda.gov/api-guide/\n\nArchive SHA256: {hashlib.sha256(archive.read_bytes()).hexdigest()}\n\nContains {len(rows)} entries from selected source categories, including raw/cooked/canned variants. This is broad reference coverage, not every food or every fruit/vegetable worldwide. Values are per 100 g edible portion; source portion labels retain measured gram weights. Missing nutrients stay null. Calories use nutrient 1008 (kcal), never kJ or calories calculated from macros; alcohol energy is therefore retained.\n\nCocktails and prepared meals are marked estimates because recipes vary. Kenko mocktails are example recipes calculated by ingredient weight with explicit FDC ingredient IDs; exclude ice and garnish. They are not official USDA finished-drink records. Gram weights must not be interpreted as ml. Users can review/edit totals before logging.\n\nRegenerate using client/scripts/import-catalog.py and the official ZIP; no runtime API key or database migration is needed.\n''')
