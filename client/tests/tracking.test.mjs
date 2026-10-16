import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
import { deriveDailyGoals } from '../src/lib/goals.ts';
import { finiteNumber, portionGrams, logTimestamp, nutritionInput } from '../src/lib/tracking.ts';
import { dayRange, localDateISO } from '../src/lib/utils.ts';
import { registerMealLogMutationDefaults, ADD_MANUAL_MEAL_KEY } from '../src/lib/mealLogMutations.ts';
import { registerWaterMutationDefaults, WATER_MUTATION_KEY } from '../src/lib/waterMutations.ts';
import { registerDishMutationDefaults, DISH_WRITE_KEY } from '../src/lib/dishMutations.ts';
import { registerMealCopyDefaults, COPY_MEAL_KEY, makeMealCopy } from '../src/lib/copyMeal.ts';
import { registerSavedMealDefaults, SAVED_MEAL_KEY, saveMealSnapshot, logSavedMeal, parseSavedFoods } from '../src/lib/savedMeals.ts';
import { registerWaterPreferenceDefaults, WATER_PREFERENCES_KEY, waterPreferenceQueryKey, latestWaterPreferences } from '../src/lib/waterPreferenceMutations.ts';
import { targetsOnDay, validateGoals, registerTargetSnapshotDefaults, TARGET_SNAPSHOT_KEY } from '../src/lib/targetSnapshots.ts';
import { registerProfileDefaults, PROFILE_WRITE_KEY, validateProfileWrite, mergeProfile } from '../src/lib/profileMutations.ts';
import { smartFoodPoints, pointsBudget, isZeroPointFood, mealPoints, dayPoints } from '../src/lib/points.ts';
import { database } from './supabase.mock.mjs';

let qc;
const meal = { id: 'meal-1', user_id: 'alice', logged_at: '2026-07-08T18:30:00.000Z', calories: 240.5, fiber_g: 4.7 };
const water = { id: 'water-1', user_id: 'alice', logged_at: meal.logged_at, amount_ml: 330 };
const mealKey = ['meal_logs', 'day', localDateISO(new Date(meal.logged_at))];
const waterKey = ['water_logs', 'day', localDateISO(new Date(water.logged_at))];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function client() { const c = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity, retry: false } } }); registerMealLogMutationDefaults(c); registerWaterMutationDefaults(c); registerDishMutationDefaults(c); registerMealCopyDefaults(c); registerSavedMealDefaults(c); registerWaterPreferenceDefaults(c); registerTargetSnapshotDefaults(c); registerProfileDefaults(c); return c; }
function mutate(key, input, c = qc) { return c.getMutationCache().build(c, { mutationKey: key }).execute(input); }
beforeEach(() => { onlineManager.setOnline(true); database.rows.clear(); database.failure = null; database.userId = 'alice'; qc = client(); });
afterEach(() => { onlineManager.setOnline(true); qc.clear(); });

test('custom calorie, macro, fiber and water targets override defaults', () => {
  const goals = deriveDailyGoals(14000, { calorie_target_override: 1800, protein_pct: 25, carbs_pct: 50, fat_pct: 25, water_goal_ml: 2300, fiber_goal_g: 30 });
  assert.equal(goals.calorieTarget, 1800); assert.equal(goals.protein, 112.5); assert.equal(goals.carbs, 225); assert.equal(goals.fat, 50); assert.equal(goals.water, 2300); assert.equal(goals.fiber, 30);
  assert.equal(deriveDailyGoals(null).isFallback, true);
  assert.equal(deriveDailyGoals(Infinity).calorieTarget, 2000);
});
test('fractional servings and grams produce the same portion; missing serving uses 100g', () => {
  assert.equal(portionGrams('1.5', 'servings', 200), portionGrams('300', 'grams', null));
  assert.equal(portionGrams('0.5', 'servings', null), 50);
  for (const invalid of ['', '0', '-1', 'NaN', 'Infinity']) assert.throws(() => portionGrams(invalid, 'grams', 100));
});
test('nutrition allows zero calories and fractional fiber; rejects negative and nonfinite values', () => {
  assert.deepEqual(nutritionInput({ calories: '0', fiber: '2.3' }), { calories: 0, fiber_g: 2.3, protein_g: null, carbs_g: null, fat_g: null });
  for (const value of ['', '-1', 'Infinity', 'NaN']) assert.throws(() => finiteNumber(value, 'Amount'));
});
test('date conversion retains the local day and DST day boundaries', () => {
  assert.equal(logTimestamp('2026-07-08T20:30'), meal.logged_at);
  assert.throws(() => logTimestamp('not-a-date')); assert.throws(() => logTimestamp('2099-01-01T12:00'));
  const range = dayRange('2026-03-29');
  assert.equal((new Date(range.end) - new Date(range.start)) / 3600000, 23);
});
test('meal writes preserve original timestamp and fiber, and replay once', async () => {
  await mutate(ADD_MANUAL_MEAL_KEY, meal); await mutate(ADD_MANUAL_MEAL_KEY, meal);
  assert.equal(database.rows.size, 1); assert.equal(database.rows.get('meal_logs:meal-1').fiber_g, 4.7);
  assert.equal(database.rows.get('meal_logs:meal-1').logged_at, meal.logged_at);
});
test('queued meal hydrates with original author and timestamp after reload', async () => {
  onlineManager.setOnline(false);
  const pending = mutate(ADD_MANUAL_MEAL_KEY, meal); await tick();
  assert.equal(qc.getQueryData(mealKey)[0].fiber_g, 4.7);
  const persisted = JSON.parse(JSON.stringify(dehydrate(qc)));
  const restored = client(); hydrate(restored, persisted);
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('meal_logs:meal-1').logged_at, meal.logged_at);
  await qc.resumePausedMutations(); await pending; assert.equal(database.rows.size, 1); restored.clear();
});
test('account changes cannot reassign queued meals or water', async () => {
  database.userId = 'bob';
  await assert.rejects(mutate(ADD_MANUAL_MEAL_KEY, meal), /account/);
  await assert.rejects(mutate(WATER_MUTATION_KEY, { operation: 'add', row: water }), /account/);
  assert.equal(database.rows.size, 0);
});
test('failed meal rollback keeps another successful meal', async () => {
  qc.setQueryData(mealKey, [{ ...meal, id: 'keep' }]); database.failure = 'Save failed';
  await assert.rejects(mutate(ADD_MANUAL_MEAL_KEY, meal));
  assert.deepEqual(qc.getQueryData(mealKey).map(r => r.id), ['keep']);
});
test('water add, correction and deletion change totals without duplicates', async () => {
  await mutate(WATER_MUTATION_KEY, { operation: 'add', row: water });
  await mutate(WATER_MUTATION_KEY, { operation: 'add', row: water });
  assert.equal(qc.getQueryData(waterKey).length, 1);
  await mutate(WATER_MUTATION_KEY, { operation: 'update', row: { ...water, amount_ml: 500 } });
  assert.equal(database.rows.get('water_logs:water-1').amount_ml, 500);
  await mutate(WATER_MUTATION_KEY, { operation: 'delete', row: water });
  assert.equal(qc.getQueryData(waterKey).length, 0); assert.equal(database.rows.size, 0);
});
test('offline water add and edit resume in order after hydration', async () => {
  onlineManager.setOnline(false);
  const a = mutate(WATER_MUTATION_KEY, { operation: 'add', row: water }); await tick();
  const b = mutate(WATER_MUTATION_KEY, { operation: 'update', row: { ...water, amount_ml: 600 } }); await tick();
  const persisted = JSON.parse(JSON.stringify(dehydrate(qc))); const restored = client(); hydrate(restored, persisted);
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('water_logs:water-1').amount_ml, 600);
  await qc.resumePausedMutations(); await Promise.all([a, b]); restored.clear();
});

test('meal categories survive persistence', async () => {
  await mutate(ADD_MANUAL_MEAL_KEY, { ...meal, meal_type: 'dinner' });
  assert.equal(database.rows.get('meal_logs:meal-1').meal_type, 'dinner');
  assert.equal(qc.getQueryData(mealKey)[0].meal_type, 'dinner');
});
test('legacy cached meals migrate only for their original account', async () => {
  const { migrateLegacyCache } = await import('../src/lib/legacyCache.ts');
  const legacy = { buster: 'alice', timestamp: Date.now(), clientState: { queries: [{ state: { data: [meal] } }], mutations: [{ mutationKey: ADD_MANUAL_MEAL_KEY, state: { variables: { id: meal.id, calories: 240.5 }, submittedAt: Date.parse(meal.logged_at) } }] } };
  const migrated = migrateLegacyCache(legacy, 'alice');
  assert.equal(migrated.clientState.mutations[0].state.variables.logged_at, meal.logged_at);
  assert.equal(migrated.clientState.mutations[0].state.variables.user_id, 'alice');
  assert.equal(migrateLegacyCache(legacy, 'bob'), undefined);
  assert.equal(migrateLegacyCache(legacy, 'anon'), undefined);
});

test('food edit moves the optimistic entry between diary days and rolls back only that entry on failure', async () => {
  const { UPDATE_MEAL_KEY } = await import('../src/lib/mealLogMutations.ts');
  const nextDate = '2026-07-09T12:00:00.000Z';
  const nextKey = ['meal_logs', 'day', localDateISO(new Date(nextDate))];
  qc.setQueryData(mealKey, [meal]);
  qc.setQueryData(nextKey, [{ ...meal, id: 'other', logged_at: nextDate }]);
  database.failure = 'Could not update';
  await assert.rejects(mutate(UPDATE_MEAL_KEY, { row: meal, edits: { logged_at: nextDate, fiber_g: 8.5 } }));
  assert.equal(qc.getQueryData(mealKey)[0].fiber_g, 4.7);
  assert.deepEqual(qc.getQueryData(nextKey).map(r => r.id), ['other']);
});

test('offline food add then edit survives hydration in order, including a change of day', async () => {
  const { UPDATE_MEAL_KEY } = await import('../src/lib/mealLogMutations.ts');
  onlineManager.setOnline(false);
  const a = mutate(ADD_MANUAL_MEAL_KEY, meal); await tick();
  const nextDate = '2026-07-09T12:00:00.000Z';
  const b = mutate(UPDATE_MEAL_KEY, { row: meal, edits: { logged_at: nextDate, calories: 310.25, fiber_g: 9.2, meal_type: 'lunch' } }); await tick();
  assert.equal(qc.getQueryData(mealKey).length, 0);
  assert.equal(qc.getQueryData(['meal_logs', 'day', '2026-07-09'])[0].calories, 310.25);
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('meal_logs:meal-1').calories, 310.25);
  assert.equal(database.rows.get('meal_logs:meal-1').logged_at, nextDate);
  assert.equal(database.rows.get('meal_logs:meal-1').meal_type, 'lunch');
  await qc.resumePausedMutations(); await Promise.all([a, b]); restored.clear();
});

test('food delete and undo preserve the original entry after offline reload', async () => {
  const { DELETE_MEAL_KEY, RESTORE_MEAL_KEY } = await import('../src/lib/mealLogMutations.ts');
  await mutate(ADD_MANUAL_MEAL_KEY, meal);
  const saved = qc.getQueryData(mealKey)[0];
  onlineManager.setOnline(false);
  const a = mutate(DELETE_MEAL_KEY, { row: saved }); await tick();
  assert.equal(qc.getQueryData(mealKey).length, 0);
  const b = mutate(RESTORE_MEAL_KEY, { row: saved }); await tick();
  assert.equal(qc.getQueryData(mealKey)[0].fiber_g, 4.7);
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.size, 1);
  assert.equal(database.rows.get('meal_logs:meal-1').logged_at, meal.logged_at);
  await qc.resumePausedMutations(); await Promise.all([a,b]); restored.clear();
});

test('all food corrections reject another account, and edits cannot change identity fields', async () => {
  const { UPDATE_MEAL_KEY, DELETE_MEAL_KEY, RESTORE_MEAL_KEY } = await import('../src/lib/mealLogMutations.ts');
  await mutate(ADD_MANUAL_MEAL_KEY, meal);
  await mutate(UPDATE_MEAL_KEY, { row: meal, edits: { calories: 200, user_id: 'bob', id: 'stolen', source: 'ai_estimate' } });
  assert.equal(database.rows.get('meal_logs:meal-1').user_id, 'alice');
  assert.equal(database.rows.get('meal_logs:meal-1').source, 'manual');
  database.userId = 'bob';
  for (const key of [UPDATE_MEAL_KEY, DELETE_MEAL_KEY, RESTORE_MEAL_KEY]) {
    await assert.rejects(mutate(key, { row: meal, edits: { calories: 99 } }), /account/);
  }
  assert.equal(database.rows.get('meal_logs:meal-1').calories, 200);
});

test('missing food updates report a failure instead of claiming success', async () => {
  const { UPDATE_MEAL_KEY } = await import('../src/lib/mealLogMutations.ts');
  await assert.rejects(mutate(UPDATE_MEAL_KEY, { row: meal, edits: { calories: 100 } }), /missing/i);
});

test('water deletion can be undone without losing its date or duplicating the entry', async () => {
  await mutate(WATER_MUTATION_KEY, { operation: 'add', row: water });
  await mutate(WATER_MUTATION_KEY, { operation: 'delete', row: water });
  await mutate(WATER_MUTATION_KEY, { operation: 'add', row: water });
  assert.equal(database.rows.size, 1);
  assert.equal(database.rows.get('water_logs:water-1').logged_at, water.logged_at);
});

test('recipe cooking yield changes density while preserving batch nutrition and fractional servings', async () => {
  const { calculateRecipe } = await import('../src/lib/recipe.ts');
  const rice = { id: 'rice', name: 'Rice', calories_per_100g: 360, protein_g_per_100g: 7, carbs_g_per_100g: 80, fat_g_per_100g: 1, fiber_g_per_100g: 2 };
  const oil = { ...rice, id: 'oil', name: 'Oil', calories_per_100g: 900, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 100, fiber_g_per_100g: 0 };
  const recipe = calculateRecipe([{ food: rice, grams: 100 }, { food: oil, grams: 10 }], 300, 2.5);
  assert.equal(recipe.per100g.calories_per_100g, 150);
  assert.equal(recipe.servingGrams, 120);
  assert.equal(recipe.caloriesPerServing, 180);
  assert.equal(recipe.per100g.fiber_g_per_100g, 2 / 3);
  assert.deepEqual(recipe.missing, []);
  const diluted = calculateRecipe([{ food: rice, grams: 100 }, { food: oil, grams: 10 }], 600, 2.5);
  assert.equal(diluted.caloriesPerServing, recipe.caloriesPerServing);
  assert.equal(diluted.per100g.calories_per_100g, 75);
});

test('recipe rejects invalid weights, empty recipes and overflow; marks missing nutrition', async () => {
  const { calculateRecipe } = await import('../src/lib/recipe.ts');
  const food = { id: 'food', name: 'Food', calories_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0, fiber_g_per_100g: null };
  assert.deepEqual(calculateRecipe([{ food, grams: 100 }], 100, 1).missing, ['fiber_g_per_100g']);
  assert.throws(() => calculateRecipe([], 100, 1));
  for (const invalid of ['', 0, -1, Infinity, NaN]) {
    assert.throws(() => calculateRecipe([{ food, grams: invalid }], 100, 1));
    assert.throws(() => calculateRecipe([{ food, grams: 100 }], invalid, 1));
    assert.throws(() => calculateRecipe([{ food, grams: 100 }], 100, invalid));
  }
  assert.throws(() => calculateRecipe([{ food: { ...food, calories_per_100g: Number.MAX_VALUE }, grams: 1000 }], 100, 1));
});

test('US fluid ounce conversion preserves canonical ml through display and corrections', async () => {
  const { waterToMl, waterFromMl } = await import('../src/lib/waterUnits.ts');
  assert.equal(waterToMl(1, 'us-fl-oz'), 29.5735295625);
  const bottle = waterToMl(16.9, 'us-fl-oz');
  assert.ok(Math.abs(waterFromMl(bottle, 'us-fl-oz') - 16.9) < 1e-12);
  assert.equal(waterToMl(330, 'ml'), 330);
  for (const invalid of ['', 0, -1, Infinity, NaN]) assert.throws(() => waterToMl(invalid, 'us-fl-oz'));
  assert.throws(() => waterToMl(Number.MAX_VALUE, 'us-fl-oz'));
  const row = { ...water, amount_ml: bottle };
  await mutate(WATER_MUTATION_KEY, { operation: 'add', row });
  assert.equal(database.rows.get('water_logs:water-1').amount_ml, bottle);
  await mutate(WATER_MUTATION_KEY, { operation: 'update', row: { ...row, amount_ml: waterToMl(8, 'us-fl-oz') } });
  assert.equal(qc.getQueryData(waterKey)[0].amount_ml, 236.5882365);
});

test('water container preferences tolerate missing or corrupt browser storage', async () => {
  const { parseWaterPreferences, DEFAULT_WATER_PREFERENCES } = await import('../src/lib/waterUnits.ts');
  for (const raw of [null, '{broken', '{}', 'null', JSON.stringify({ unit: 'uk-fl-oz', containers: [] }), JSON.stringify({ unit: 'ml', containers: Array(3).fill({ name: 'Bottle', ml: -1 }) })]) {
    assert.deepEqual(parseWaterPreferences(raw), DEFAULT_WATER_PREFERENCES);
  }
  const preferences = { unit: 'us-fl-oz', containers: [{ name: 'Cup', ml: 200 }, { name: 'Bottle', ml: 500 }, { name: 'Jug', ml: 1000 }] };
  assert.deepEqual(parseWaterPreferences(JSON.stringify(preferences)), preferences);
});


test('food ounces, grams and fractional servings preserve quantity when switching units', async () => {
  const { portionFromGrams } = await import('../src/lib/tracking.ts');
  assert.equal(portionGrams('1', 'ounces', null), 28.349523125);
  const grams = portionGrams('1.5', 'servings', 180);
  assert.equal(grams, 270);
  const ounces = portionFromGrams(grams, 'ounces', 180);
  assert.ok(Math.abs(portionGrams(String(ounces), 'ounces', 180) - grams) < 1e-10);
  assert.equal(portionFromGrams(grams, 'servings', 180), 1.5);
  assert.throws(() => portionGrams(String(Number.MAX_VALUE), 'ounces', null));
});


test('missing nutrients remain unknown through offline persistence, editing and recent reuse', async () => {
  const { nutrientInputValue, hasMissingNutrients, formatNutrient } = await import('../src/lib/tracking.ts');
  const { UPDATE_MEAL_KEY } = await import('../src/lib/mealLogMutations.ts');
  const nutrition = nutritionInput({ calories: '100', protein: '0', carbs: '', fat: ' ', fiber: '2.5' });
  assert.equal(nutrition.protein_g, 0);
  assert.equal(nutrition.carbs_g, null);
  assert.equal(nutrientInputValue(null), '');
  assert.equal(nutrientInputValue(0), '0');
  assert.equal(formatNutrient(null), 'Not entered');
  assert.equal(formatNutrient(0), '0 g');
  assert.equal(hasMissingNutrients(nutrition), true);
  onlineManager.setOnline(false);
  const pending = mutate(ADD_MANUAL_MEAL_KEY, { ...meal, ...nutrition }); await tick();
  const persisted = JSON.parse(JSON.stringify(dehydrate(qc)));
  const restored = client(); hydrate(restored, persisted);
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('meal_logs:meal-1').carbs_g, null);
  assert.equal(database.rows.get('meal_logs:meal-1').protein_g, 0);
  await qc.resumePausedMutations(); await pending;
  await mutate(UPDATE_MEAL_KEY, { row: { ...meal, ...nutrition }, edits: { protein_g: null, carbs_g: 0 } });
  assert.equal(database.rows.get('meal_logs:meal-1').protein_g, null);
  assert.equal(database.rows.get('meal_logs:meal-1').carbs_g, 0);
  restored.clear();
});


test('repeating a food scales all known nutrients and keeps unknown values blank', async () => {
  const { repeatNutrition } = await import('../src/lib/tracking.ts');
  const previous = { calories: 250, protein_g: 12, carbs_g: null, fat_g: 0, fiber_g: 3.5 };
  assert.deepEqual(repeatNutrition(previous, '0.5'), { calories: '125', protein: '6', carbs: '', fat: '0', fiber: '1.75' });
  assert.equal(repeatNutrition(previous, '2').calories, '500');
  for (const amount of ['', '0', '-1', 'Infinity', 'NaN']) assert.throws(() => repeatNutrition(previous, amount));
  assert.throws(() => repeatNutrition({ ...previous, calories: Number.MAX_VALUE }, '2'));
});


test('first-use target setup shares settings validation without inventing profile data', async () => {
  const { targetForm, parseTargets } = await import('../src/lib/goals.ts');
  const defaults = parseTargets(targetForm(null));
  assert.equal(defaults.calorie_target_override, null);
  assert.equal(defaults.water_goal_ml, 2000);
  assert.equal(defaults.protein_pct + defaults.carbs_pct + defaults.fat_pct, 100);
  assert.equal('biological_sex' in defaults, false);
  assert.equal('height_cm' in defaults, false);
  assert.equal(parseTargets({ ...targetForm(null), calorie_target_override: '1850' }).calorie_target_override, 1850);
  assert.throws(() => parseTargets({ ...targetForm(null), fat_pct: '10' }));
  assert.throws(() => parseTargets({ ...targetForm(null), water_goal_ml: 'Infinity' }));
});


test('offline dish creation and favorite edits survive reload and replay without duplicates', async () => {
  const input = { operation: 'add', id: 'dish-1', user_id: 'alice', created_at: meal.logged_at, edits: { name: 'Rice', calories_per_100g: 130 } };
  onlineManager.setOnline(false);
  const add = mutate(DISH_WRITE_KEY, input); await tick();
  const favorite = mutate(DISH_WRITE_KEY, { ...input, operation: 'update', edits: { is_favorite: true } }); await tick();
  assert.equal(qc.getQueryData(['dishes'])[0].is_favorite, true);
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('dishes:dish-1').is_favorite, true);
  await qc.resumePausedMutations(); await Promise.all([add, favorite]);
  assert.equal(database.rows.size, 1);
  assert.equal(database.rows.get('dishes:dish-1').name, 'Rice');
  restored.clear();
});

test('dish mutations retain authorship, whitelist edits, and restore failed deletions', async () => {
  const input = { operation: 'add', id: 'dish-1', user_id: 'alice', created_at: meal.logged_at, edits: { name: 'Rice', calories_per_100g: 130 } };
  await mutate(DISH_WRITE_KEY, input);
  await mutate(DISH_WRITE_KEY, { ...input, operation: 'update', edits: { id: 'hijack', user_id: 'bob', is_favorite: true } });
  assert.equal(database.rows.get('dishes:dish-1').user_id, 'alice');
  database.failure = 'Dish is referenced by a meal';
  await assert.rejects(mutate(DISH_WRITE_KEY, { ...input, operation: 'delete', edits: {} }));
  assert.equal(qc.getQueryData(['dishes'])[0].is_favorite, true);
  database.failure = null; database.userId = 'bob';
  await assert.rejects(mutate(DISH_WRITE_KEY, { ...input, operation: 'update', edits: { name: 'Changed' } }), /account/);
  assert.equal(database.rows.get('dishes:dish-1').name, 'Rice');
});


test('diary deep links accept past local dates and reject invalid or future dates', async () => {
  const { diaryDate } = await import('../src/lib/tracking.ts');
  const today = '2026-09-12';
  assert.equal(diaryDate('2026-03-29', today), '2026-03-29');
  assert.equal(diaryDate('2024-02-29', today), '2024-02-29');
  for (const input of [null, '', '2026-02-30', '2025-02-29', '2026-13-01', '2026-09-13', 'not-a-date', '2026-9-1']) assert.equal(diaryDate(input, today), today);
});


test('dated loggers use current local time today and noon for a historical day', async () => {
  const { initialLogTime } = await import('../src/lib/tracking.ts');
  const now = new Date('2026-07-08T18:30:00.000Z');
  assert.equal(initialLogTime('2026-07-08', now), '2026-07-08T20:30');
  assert.equal(initialLogTime('2026-03-29', now), '2026-03-29T12:00');
  assert.equal(initialLogTime('invalid', now), '2026-07-08T20:30');
  assert.equal(initialLogTime('2026-07-09', now), '2026-07-08T20:30');
});

test('saved recipe ingredients and yield survive offline dish replay with nutrition snapshots', async () => {
  const { parseRecipeDetails, calculateRecipe } = await import('../src/lib/recipe.ts');
  const food = { id: 'rice', name: 'Rice', calories_per_100g: 360, protein_g_per_100g: 7, carbs_g_per_100g: 80, fat_g_per_100g: 1, fiber_g_per_100g: 2 };
  const details = { version: 1, ingredients: [{ food, grams: 100 }], yieldGrams: 300, servings: 2 };
  const snapshot = parseRecipeDetails(details);
  food.calories_per_100g = 999;
  assert.equal(snapshot.ingredients[0].food.calories_per_100g, 360);
  onlineManager.setOnline(false);
  const pending = mutate(DISH_WRITE_KEY, { operation: 'add', id: 'recipe-1', user_id: 'alice', created_at: meal.logged_at, edits: { name: 'Cooked rice', calories_per_100g: 120, recipe_details: snapshot } }); await tick();
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  const recipe = parseRecipeDetails(database.rows.get('dishes:recipe-1').recipe_details);
  assert.equal(calculateRecipe(recipe.ingredients, recipe.yieldGrams, recipe.servings).caloriesPerServing, 180);
  await qc.resumePausedMutations(); await pending; restored.clear();
});

test('malformed recipe details are rejected without breaking the editor', async () => {
  const { parseRecipeDetails } = await import('../src/lib/recipe.ts');
  for (const value of [null, {}, { version: 2 }, { version: 1, ingredients: [], yieldGrams: 100, servings: 1 }, { version: 1, ingredients: [null], yieldGrams: 100, servings: 1 }]) assert.equal(parseRecipeDetails(value), null);
  await assert.rejects(mutate(DISH_WRITE_KEY, { operation: 'add', id: 'bad', user_id: 'alice', created_at: meal.logged_at, edits: { name: 'Bad recipe', calories_per_100g: 0, recipe_details: { version: 1 } } }), /Recipe/);
  assert.equal(database.rows.size, 0);
});


test('water date corrections move both diary caches and restore them on failure', async () => {
  await mutate(WATER_MUTATION_KEY, { operation: 'add', row: water });
  const moved = { ...water, logged_at: '2026-07-07T12:00:00.000Z', amount_ml: 500 };
  const destination = ['water_logs', 'day', '2026-07-07'];
  await mutate(WATER_MUTATION_KEY, { operation: 'update', row: moved });
  assert.equal(qc.getQueryData(waterKey).length, 0);
  assert.equal(qc.getQueryData(destination)[0].amount_ml, 500);
  database.failure = 'Unavailable';
  await assert.rejects(mutate(WATER_MUTATION_KEY, { operation: 'update', row: water }));
  assert.equal(qc.getQueryData(waterKey).length, 0);
  assert.equal(qc.getQueryData(destination)[0].logged_at, moved.logged_at);
});

test('offline water date correction survives hydration after an earlier queued add', async () => {
  onlineManager.setOnline(false);
  const add = mutate(WATER_MUTATION_KEY, { operation: 'add', row: water }); await tick();
  const moved = { ...water, logged_at: '2026-07-07T12:00:00.000Z' };
  const edit = mutate(WATER_MUTATION_KEY, { operation: 'update', row: moved }); await tick();
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('water_logs:water-1').logged_at, moved.logged_at);
  assert.equal(restored.getQueryData(waterKey).length, 0);
  await qc.resumePausedMutations(); await Promise.all([add, edit]); restored.clear();
});


test('cache expiry preserves unsynced work without refreshing query data or mixing accounts', async () => {
  const { retainUnsyncedCache } = await import('../src/lib/offlineRetention.ts');
  const { persistQueryClientRestore } = await import('@tanstack/react-query-persist-client');
  onlineManager.setOnline(false);
  const pending = mutate(ADD_MANUAL_MEAL_KEY, meal); await tick();
  const old = { buster: 'alice', timestamp: Date.now() - 7 * 86400000, clientState: JSON.parse(JSON.stringify(dehydrate(qc))) };
  const restored = client();
  let removed = false;
  await persistQueryClientRestore({ queryClient: restored, buster: 'alice', maxAge: 86400000, persister: {
    restoreClient: async () => retainUnsyncedCache(old, 'alice'), persistClient: async () => {}, removeClient: async () => { removed = true; },
  } });
  assert.equal(removed, false);
  assert.equal(restored.getMutationCache().getAll().length, 1);
  assert.equal(retainUnsyncedCache(old, 'bob'), undefined);
  assert.equal(retainUnsyncedCache(old, 'anon'), undefined);
  assert.equal(retainUnsyncedCache(old, 'alice').clientState.queries[0].state.dataUpdatedAt, old.clientState.queries[0].state.dataUpdatedAt);
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('meal_logs:meal-1').logged_at, meal.logged_at);
  await qc.resumePausedMutations(); await pending; restored.clear();
});

test('normal synced caches keep their original expiry while failed writes stay recoverable', async () => {
  const { retainUnsyncedCache } = await import('../src/lib/offlineRetention.ts');
  const saved = { buster: 'alice', timestamp: 100, clientState: { queries: [], mutations: [] } };
  assert.equal(retainUnsyncedCache(saved, 'alice', 200), saved);
  const failed = { ...saved, clientState: { queries: [], mutations: [{ state: { status: 'error', isPaused: false } }] } };
  assert.equal(retainUnsyncedCache(failed, 'alice', 200).timestamp, 200);
});


test('per-serving food labels normalize to 100g and retain quantity through basis switching', async () => {
  const { convertLabelValue } = await import('../src/lib/tracking.ts');
  assert.equal(convertLabelValue('150', 'serving', '100g', '30'), '500');
  assert.equal(convertLabelValue('500', '100g', 'serving', '30'), '150');
  assert.equal(convertLabelValue('2.5', 'serving', '100g', '50'), '5');
  assert.equal(convertLabelValue('0', 'serving', '100g', '30'), '0');
  assert.equal(convertLabelValue('', '100g', 'serving', ''), '');
  for (const serving of ['', '0', '-1', 'Infinity']) assert.throws(() => convertLabelValue('150', 'serving', '100g', serving));
});


test('saved dishes retain unknown nutrients separately from explicit zeros', async () => {
  await mutate(DISH_WRITE_KEY, { operation: 'add', id: 'unknown-dish', user_id: 'alice', created_at: meal.logged_at, edits: { name: 'Label food', calories_per_100g: 100, protein_g_per_100g: 0, carbs_g_per_100g: null } });
  const dish = database.rows.get('dishes:unknown-dish');
  assert.equal(dish.protein_g_per_100g, 0);
  assert.equal(dish.carbs_g_per_100g, null);
  assert.equal(dish.fat_g_per_100g, null);
  assert.equal(dish.fiber_g_per_100g, null);
});


test('whole-meal copies preserve individual foods and unknown nutrients through offline replay', async () => {
  const original = { ...meal, confirmed: true, protein_g: null, carbs_g: 5, fat_g: 0, meal_type: 'breakfast', raw_text_input: 'Toast' };
  let id = 0;
  const input = makeMealCopy([original, { ...original, id: 'second', raw_text_input: 'Coffee', calories: 0 }], 'alice', '2026-07-07T09:00', 'breakfast', () => `copy-${++id}`);
  onlineManager.setOnline(false);
  const pending = mutate(COPY_MEAL_KEY, input); await tick();
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.size, 2);
  assert.equal(database.rows.get('meal_logs:copy-1').protein_g, null);
  assert.equal(database.rows.get('meal_logs:copy-2').calories, 0);
  await qc.resumePausedMutations(); await pending;
  assert.equal(database.rows.size, 2); restored.clear();
});

test('failed meal copies roll back only copied foods and reject another account', async () => {
  const original = { ...meal, confirmed: true };
  const input = makeMealCopy([original], 'alice', '2026-07-08T20:30', 'dinner', () => 'new-copy');
  qc.setQueryData(mealKey, [original]); database.failure = 'Unavailable';
  await assert.rejects(mutate(COPY_MEAL_KEY, input));
  assert.deepEqual(qc.getQueryData(mealKey), [original]);
  database.failure = null; database.userId = 'bob';
  await assert.rejects(mutate(COPY_MEAL_KEY, input), /account/);
  assert.equal(database.rows.size, 0);
  assert.throws(() => makeMealCopy([{ ...original, user_id: 'bob' }], 'alice', '2026-07-08T20:30', 'dinner'), /confirmed/);
});


test('named meals survive offline creation and rename, retaining independent nutrition snapshots', async () => {
  const original = { ...meal, confirmed: true, raw_text_input: 'Breakfast oats', protein_g: null, carbs_g: 30, fat_g: 0 };
  const saved = saveMealSnapshot([original], 'alice', ' Usual breakfast ', 'breakfast');
  original.calories = 999;
  assert.equal(parseSavedFoods(saved.foods)[0].calories, 240.5);
  onlineManager.setOnline(false);
  const add = mutate(SAVED_MEAL_KEY, { operation: 'add', row: saved }); await tick();
  const rename = mutate(SAVED_MEAL_KEY, { operation: 'update', row: { ...saved, name: 'Quick breakfast' } }); await tick();
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get(`saved_meals:${saved.id}`).name, 'Quick breakfast');
  await qc.resumePausedMutations(); await Promise.all([add, rename]); restored.clear();
  assert.equal(database.rows.size, 1);
  const copy = logSavedMeal(saved, 'alice', '0.5', '2026-07-08T08:00', 'breakfast');
  assert.equal(copy.rows[0].calories, 120.25);
  assert.equal(copy.rows[0].protein_g, null);
  assert.equal(copy.rows[0].fat_g, 0);
  assert.equal(copy.rows[0].dish_id, null);
  await mutate(COPY_MEAL_KEY, copy);
  await mutate(SAVED_MEAL_KEY, { operation: 'delete', row: saved });
  assert.equal(database.rows.get(`meal_logs:${copy.rows[0].id}`).calories, 120.25);
});

test('saved meals reject invalid foods and another account, and restore failed deletion', async () => {
  assert.throws(() => parseSavedFoods([]));
  assert.throws(() => parseSavedFoods([{ name: 'Invalid', calories: -1 }]));
  assert.throws(() => saveMealSnapshot([{ ...meal, confirmed: false }], 'alice', 'Draft', 'lunch'));
  const saved = saveMealSnapshot([{ ...meal, confirmed: true }], 'alice', 'Lunch', 'lunch');
  await mutate(SAVED_MEAL_KEY, { operation: 'add', row: saved });
  database.failure = 'Unavailable';
  await assert.rejects(mutate(SAVED_MEAL_KEY, { operation: 'delete', row: saved }));
  assert.equal(qc.getQueryData(['saved_meals'])[0].id, saved.id);
  database.failure = null; database.userId = 'bob';
  await assert.rejects(mutate(SAVED_MEAL_KEY, { operation: 'update', row: { ...saved, name: 'Changed' } }), /account/);
  assert.throws(() => logSavedMeal(saved, 'bob', '1', '2026-07-08T08:00', 'lunch'), /account/);
});


test('historical completeness reports missing nutrient counts without mislabelling measured zeros', async () => {
  const { completenessMessage } = await import('../src/lib/nutritionCompleteness.ts');
  assert.equal(completenessMessage(undefined), '');
  assert.equal(completenessMessage({ incomplete_meal_count: 0, missing_fiber_count: 0 }), '');
  const message = completenessMessage({ incomplete_meal_count: 2, missing_protein_count: 1, missing_carbs_count: 0, missing_fat_count: 0, missing_fiber_count: 2 });
  assert.match(message, /^2 foods have incomplete nutrition/);
  assert.match(message, /protein \(1\)/);
  assert.match(message, /fiber \(2\)/);
  assert.doesNotMatch(message, /carbs/);
});


test('water preference changes replay in order after offline reload and are stored for the account', async () => {
  const preferences = { unit: 'ml', containers: [{ name: 'Cup', ml: 200 }, { name: 'Bottle', ml: 500 }, { name: 'Jug', ml: 1000 }] };
  const input = { user_id: 'alice', preferences, updated_at: meal.logged_at };
  onlineManager.setOnline(false);
  const first = mutate(WATER_PREFERENCES_KEY, input); await tick();
  const last = mutate(WATER_PREFERENCES_KEY, { ...input, preferences: { ...preferences, unit: 'us-fl-oz' } }); await tick();
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('water_preferences:alice').preferences.unit, 'us-fl-oz');
  await qc.resumePausedMutations(); await Promise.all([first, last]); restored.clear();
  assert.equal(database.rows.size, 1);
});

test('water preference writes reject invalid presets and another account', async () => {
  const preferences = { unit: 'ml', containers: [{ name: 'Cup', ml: 200 }, { name: 'Bottle', ml: 500 }, { name: 'Jug', ml: 1000 }] };
  const input = { user_id: 'alice', preferences, updated_at: meal.logged_at };
  await assert.rejects(mutate(WATER_PREFERENCES_KEY, { ...input, preferences: { ...preferences, containers: [] } }));
  database.userId = 'bob';
  await assert.rejects(mutate(WATER_PREFERENCES_KEY, input), /account/);
  assert.equal(database.rows.size, 0);
});


test('historical targets select last observation for the exact day without borrowing other days', () => {
  const old = deriveDailyGoals(null, { calorie_target_override: 1800, water_goal_ml: 2200 });
  const newer = deriveDailyGoals(null, { calorie_target_override: 2100, water_goal_ml: 2500 });
  const rows = [
    { id: 'a', day: '2026-07-08', observed_at: '2026-07-08T10:00:00.000Z', goals: old },
    { id: 'b', day: '2026-07-09', observed_at: '2026-07-09T10:00:00.000Z', goals: newer },
    { id: 'c', day: '2026-07-08', observed_at: '2026-07-08T18:00:00.000Z', goals: newer },
  ];
  assert.deepEqual(targetsOnDay(rows, '2026-07-08'), newer);
  assert.equal(targetsOnDay(rows, '2026-07-07'), null);
  assert.deepEqual(targetsOnDay(rows.slice(0, 2), '2026-07-08'), old);
  assert.throws(() => validateGoals({ ...old, water: Infinity }));
});

test('target snapshots replay offline with original date and owner and are duplicate safe', async () => {
  const input = { id: 'snapshot-1', user_id: 'alice', day: '2026-07-08', observed_at: '2026-07-08T23:00:00.000Z', goals: deriveDailyGoals(null) };
  onlineManager.setOnline(false);
  const pending = mutate(TARGET_SNAPSHOT_KEY, input);
  await tick();
  const state = dehydrate(qc); qc.clear();
  const restored = client(); hydrate(restored, state);
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.deepEqual(database.rows.get('daily_target_snapshots:snapshot-1'), input);
  await mutate(TARGET_SNAPSHOT_KEY, { ...input, goals: { ...input.goals, water: 3000 } }, restored);
  assert.equal(database.rows.get('daily_target_snapshots:snapshot-1').goals.water, 2000);
  database.userId = 'bob';
  await assert.rejects(mutate(TARGET_SNAPSHOT_KEY, input, restored), /original account/);
  restored.clear(); void pending;
});


test('profile target edits persist offline and replay in order without resetting body fields', async () => {
  const base = { user_id: 'alice', updated_at: '2026-07-08T10:00:00.000Z', calorie_target_override: 1800, protein_pct: 30, carbs_pct: 40, fat_pct: 30, water_goal_ml: 2200, fiber_goal_g: 28 };
  database.rows.set('user_profile:alice', { ...base, height_cm: 170 });
  onlineManager.setOnline(false);
  const first = mutate(PROFILE_WRITE_KEY, base);
  const second = mutate(PROFILE_WRITE_KEY, { ...base, water_goal_ml: 2600 });
  await tick();
  const saved = dehydrate(qc); qc.clear();
  const restored = client(); hydrate(restored, saved);
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.equal(database.rows.get('user_profile:alice').water_goal_ml, 2600);
  assert.equal(database.rows.get('user_profile:alice').height_cm, 170);
  assert.equal(restored.getQueryData(['user_profile', 'alice']).water_goal_ml, 2600);
  restored.clear(); void first; void second;
});

test('profile validation and overlays preserve original ownership and confirmed values on failure', async () => {
  const input = { user_id: 'alice', updated_at: '2026-07-08T10:00:00.000Z', calorie_target_override: null, protein_pct: 30, carbs_pct: 40, fat_pct: 30, water_goal_ml: 2200, fiber_goal_g: 28 };
  assert.throws(() => validateProfileWrite({ ...input, protein_pct: 90 }));
  assert.throws(() => validateProfileWrite({ ...input, birth_date: '2026-02-30' }));
  assert.throws(() => validateProfileWrite({ ...input, water_goal_ml: Infinity }));
  assert.equal(validateProfileWrite({ ...input, injected: 'field' }).injected, undefined);
  const confirmed = mergeProfile(null, [input]);
  assert.equal(confirmed.height_cm, null);
  assert.equal(mergeProfile(confirmed, [{ ...input, water_goal_ml: 3000 }]).water_goal_ml, 3000);
  assert.equal(confirmed.water_goal_ml, 2200);
  qc.setQueryData(['user_profile', 'alice'], confirmed);
  database.failure = 'Unavailable';
  await assert.rejects(mutate(PROFILE_WRITE_KEY, { ...input, water_goal_ml: 3000 }), /Unavailable/);
  assert.equal(qc.getQueryData(['user_profile', 'alice']).water_goal_ml, 2200);
  database.failure = null; database.userId = 'bob';
  await assert.rejects(mutate(PROFILE_WRITE_KEY, input), /account that changed/);
  assert.equal(database.rows.size, 0);
});


test('retrying an older failed profile save after reload cannot overwrite newer confirmed targets', async () => {
  const old = { user_id: 'alice', updated_at: '2026-07-08T10:00:00.000Z', calorie_target_override: null, protein_pct: 30, carbs_pct: 40, fat_pct: 30, water_goal_ml: 2200, fiber_goal_g: 28 };
  database.failure = 'Temporary failure';
  await assert.rejects(mutate(PROFILE_WRITE_KEY, old));
  database.failure = null;
  const newer = { ...old, updated_at: '2026-07-08T11:00:00.000Z', water_goal_ml: 3000 };
  await mutate(PROFILE_WRITE_KEY, newer);
  const state = dehydrate(qc, { shouldDehydrateMutation: m => m.state.status === 'error' });
  const restored = client(); hydrate(restored, state);
  const failed = restored.getMutationCache().findAll({ status: 'error' });
  assert.equal(failed.length, 1);
  await failed[0].execute(failed[0].state.variables);
  assert.equal(database.rows.get('user_profile:alice').water_goal_ml, 3000);
  assert.equal(restored.getQueryData(['user_profile', 'alice']).water_goal_ml, 3000);
  assert.equal(mergeProfile(mergeProfile(null, [newer]), [old]).water_goal_ml, 3000);
  restored.clear();
});


test('water preference retries retain newer confirmed containers after persisted reload', async () => {
  const preferences = { unit: 'ml', containers: [{ name: 'Glass', ml: 250 }, { name: 'Bottle', ml: 500 }, { name: 'Large', ml: 750 }] };
  const old = { user_id: 'alice', preferences, updated_at: '2026-07-08T10:00:00.000Z' };
  database.failure = 'Temporary failure';
  await assert.rejects(mutate(WATER_PREFERENCES_KEY, old));
  database.failure = null;
  const newer = { ...old, preferences: { ...preferences, unit: 'us-fl-oz' }, updated_at: '2026-07-08T11:00:00.000Z' };
  await mutate(WATER_PREFERENCES_KEY, newer);
  const state = dehydrate(qc, { shouldDehydrateMutation: m => m.state.status === 'error' });
  const restored = client(); hydrate(restored, state);
  const failed = restored.getMutationCache().findAll({ status: 'error' })[0];
  await failed.execute(failed.state.variables);
  assert.equal(database.rows.get('water_preferences:alice').preferences.unit, 'us-fl-oz');
  assert.equal(restored.getQueryData(waterPreferenceQueryKey('alice')).preferences.unit, 'us-fl-oz');
  assert.equal(latestWaterPreferences(newer, [old]).preferences.unit, 'us-fl-oz');
  restored.clear();
});


import catalogData from '../src/data/food-catalog.json';
import { searchCatalog, catalogNutrition, catalogDish, catalogMeal, foodPreparations, saveCatalogTemplate, savedDishCatalogFood, quickBasketPortion, basketNutrition, basketTotals } from '../src/lib/catalog.ts';
test('catalog reference records retain valid units, unique IDs and source nutrient completeness', () => {
  assert.equal(new Set(catalogData.map(f => f.id)).size, catalogData.length);
  for (const category of ['Fruits','Vegetables','Beans & legumes','Drinks','Cocktails','Mocktails','Meals']) assert.ok(catalogData.some(f => f.category === category));
  for (const food of catalogData) {
    for (const value of Object.values(food.nutrition)) assert.ok(value === null || (Number.isFinite(value) && value >= 0));
    for (const portion of food.portions) assert.ok(Number.isFinite(portion.grams) && portion.grams > 0);
    if (food.category === 'Mocktails') assert.ok(food.estimated && food.recipe.includes('FDC'));
  }
});
test('catalog search matches multiple words and accents and scales portions without inventing missing values', () => {
  const bananas = searchCatalog(catalogData, 'banana raw', 'Fruits');
  assert.ok(bananas.length > 0);
  assert.ok(bananas.every(food => !food.name.toLowerCase().includes("strawberry")));
  const banana = bananas[0];
  assert.equal(Number(catalogNutrition(banana, 150).calories), banana.nutrition.calories * 1.5);
  const unknown = { ...banana, nutrition: { ...banana.nutrition, protein: null, fiber: 0 } };
  assert.equal(catalogNutrition(unknown, 100).protein, '');
  assert.equal(catalogNutrition(unknown, 100).fiber, '0');
  assert.throws(() => catalogNutrition(banana, '0'));
  assert.throws(() => catalogNutrition(banana, 'Infinity'));
  assert.ok(searchCatalog(catalogData, 'piña colada', 'Cocktails').length > 0);
  assert.equal(searchCatalog(catalogData, 'not-a-real-food-xyz', '').length, 0);
});

test('catalog dish snapshots preserve per-100g nutrition, measured serving and source through offline replay', async () => {
  const food = catalogData.find(food => food.name === 'Bananas, raw');
  const edits = catalogDish(food, 150);
  assert.equal(edits.calories_per_100g, 89);
  assert.equal(edits.reference_serving_g, 150);
  assert.ok(edits.notes.includes(food.id));
  assert.equal(catalogDish({ ...food, nutrition: { ...food.nutrition, fiber: null } }, 100).fiber_g_per_100g, null);
  assert.throws(() => catalogDish(food, 0));
  onlineManager.setOnline(false);
  mutate(DISH_WRITE_KEY, { operation: 'add', id: 'catalog-banana', user_id: 'alice', created_at: meal.logged_at, edits });
  await tick();
  const saved = dehydrate(qc);
  const resumed = client();
  hydrate(resumed, saved);
  onlineManager.setOnline(true);
  await resumed.resumePausedMutations();
  const row = database.rows.get('dishes:catalog-banana');
  assert.equal(row.calories_per_100g, 89);
  assert.equal(row.reference_serving_g, 150);
  assert.equal(row.notes, edits.notes);
  resumed.clear();
});

test('catalog meal keeps individual portions and a historical meal category through offline replay', async () => {
  const food = catalogData.find(food => food.name === 'Bananas, raw');
  const unknown = { ...food, nutrition: { ...food.nutrition, fiber: null } };
  const items = [{ id: 'a', food, grams: '150' }, { id: 'b', food: unknown, grams: '75' }];
  const input = catalogMeal(items, 'alice', '2026-07-08T12:00', 'lunch');
  assert.equal(input.rows.length, 2);
  assert.notEqual(input.rows[0].id, input.rows[1].id);
  assert.deepEqual(input.rows.map(row => row.calories), [133.5, 66.75]);
  assert.equal(input.rows[1].fiber_g, null);
  assert.ok(input.rows.every(row => row.meal_type === 'lunch' && row.logged_at === '2026-07-08T10:00:00.000Z'));
  assert.throws(() => catalogMeal([], 'alice', '2026-07-08T12:00', 'lunch'));
  assert.throws(() => catalogMeal(items, '', '2026-07-08T12:00', 'lunch'));
  assert.throws(() => catalogMeal([{ ...items[0], grams: '-2' }], 'alice', '2026-07-08T12:00', 'lunch'));
  onlineManager.setOnline(false);
  mutate(COPY_MEAL_KEY, input);
  await tick();
  const resumed = client();
  hydrate(resumed, dehydrate(qc));
  onlineManager.setOnline(true);
  await resumed.resumePausedMutations();
  await mutate(COPY_MEAL_KEY, input, resumed);
  assert.equal([...database.rows.keys()].filter(key => key.startsWith('meal_logs:')).length, 2);
  resumed.clear();
});

test('catalog common names and preparation filters find the matching source foods', () => {
  for (const [alias, source] of [['aubergine', 'eggplant'], ['courgette', 'zucchini'], ['garbanzo', 'chickpea'], ['rocket', 'arugula'], ['groundnut', 'peanut']]) {
    const result = searchCatalog(catalogData, alias, '');
    assert.ok(result.length > 0, alias);
    assert.deepEqual(result.map(food => food.id), searchCatalog(catalogData, source, '').map(food => food.id));
  }
  const raw = searchCatalog(catalogData, 'broccoli', 'Vegetables', 'Raw');
  assert.ok(raw.length > 0);
  assert.ok(raw.every(food => foodPreparations(food).includes('Raw')));
  const cooked = searchCatalog(catalogData, 'broccoli', 'Vegetables', 'Cooked');
  assert.ok(cooked.length > 0);
  assert.ok(cooked.every(food => !food.name.includes('uncooked')));
  assert.ok(searchCatalog(catalogData, 'piña-colada', 'Cocktails').length > 0);
  assert.equal(searchCatalog(catalogData, 'banana raw', '')[0].name, 'Bananas, raw');
  assert.deepEqual(foodPreparations({ name: 'Broccoli, frozen, cooked, boiled' }), ['Cooked', 'Frozen']);
});

import { catalogDraftKey, parseCatalogDraft, activeCatalogDraft, remainingBasketAfterLog } from '../src/lib/catalogDraft.ts';
test('catalog drafts retain unfinished fields and reject other accounts, days and malformed snapshots', () => {
  const food = catalogData.find(food => food.name === 'Bananas, raw');
  const draft = { version: 1, userId: 'alice', day: '2026-07-08', when: '2026-07-08T12:30', mealType: 'snack', items: [{ id: 'draft-a', food, grams: '' }] };
  const raw = JSON.stringify(draft);
  assert.deepEqual(parseCatalogDraft(raw, 'alice', draft.day), draft);
  assert.equal(parseCatalogDraft(raw, 'bob', draft.day), null);
  assert.equal(parseCatalogDraft(raw, 'alice', '2026-07-09'), null);
  assert.notEqual(catalogDraftKey('alice', draft.day), catalogDraftKey('bob', draft.day));
  assert.equal(parseCatalogDraft('broken json', 'alice', draft.day), null);
  for (const changed of [
    { ...draft, version: 2 }, { ...draft, items: [draft.items[0], draft.items[0]] },
    { ...draft, items: [{ ...draft.items[0], food: { ...food, nutrition: { ...food.nutrition, calories: -1 } } }] },
    { ...draft, mealType: 'invalid' },
  ]) assert.equal(parseCatalogDraft(JSON.stringify(changed), 'alice', draft.day), null);
  assert.equal(parseCatalogDraft(JSON.stringify({ ...draft, items: [] }), 'alice', draft.day).items.length, 0);
});

test('basket templates save independently of the diary and retain measured snapshots when reused', async () => {
  const food = catalogData.find(food => food.name === 'Bananas, raw');
  const items = [{ id: 'draft-a', food, grams: '150' }];
  const row = saveCatalogTemplate(items, 'alice', 'Fruit breakfast', 'breakfast');
  assert.equal(row.foods[0].calories, 133.5);
  assert.equal(row.foods[0].name, 'Bananas, raw · 150 g');
  assert.throws(() => saveCatalogTemplate(items, 'alice', '', 'breakfast'));
  onlineManager.setOnline(false);
  mutate(SAVED_MEAL_KEY, { operation: 'add', row });
  await tick();
  const resumed = client(); hydrate(resumed, dehydrate(qc));
  onlineManager.setOnline(true); await resumed.resumePausedMutations();
  assert.ok(database.rows.has(`saved_meals:${row.id}`));
  assert.equal([...database.rows.keys()].filter(key => key.startsWith('meal_logs:')).length, 0);
  const copy = logSavedMeal(row, 'alice', '0.5', '2026-07-08T08:00', 'breakfast');
  assert.equal(copy.rows[0].calories, 66.75);
  assert.equal(items[0].grams, '150');
  resumed.clear();
});

test('personal dishes join catalog baskets with independent measured nutrition snapshots', () => {
  const dish = { id: 'personal-bowl', name: 'Rice bowl', source: 'custom_recipe', calories_per_100g: 120, protein_g_per_100g: null, carbs_g_per_100g: 25, fat_g_per_100g: 1, fiber_g_per_100g: 2, reference_serving_g: 200 };
  const food = savedDishCatalogFood(dish);
  const items = [{ id: 'personal-item', food, grams: String(portionGrams('1.5', 'servings', dish.reference_serving_g)) }];
  const input = catalogMeal(items, 'alice', '2026-07-08T12:00', 'lunch');
  assert.equal(input.rows[0].calories, 360);
  assert.equal(input.rows[0].protein_g, null);
  dish.calories_per_100g = 999;
  assert.equal(catalogMeal(items, 'alice', '2026-07-08T12:00', 'lunch').rows[0].calories, 360);
  const draft = { version: 1, userId: 'alice', day: '2026-07-08', when: '2026-07-08T12:00', mealType: 'lunch', items };
  assert.equal(parseCatalogDraft(JSON.stringify(draft), 'alice', draft.day).items[0].food.id, 'personal:personal-bowl');
});

test('quick foods and measured foods share a basket without inventing gram weights', () => {
  const quick = quickBasketPortion('Lunch label', { calories: '240', protein: '', carbs: '30', fat: '8', fiber: '0' });
  quick.portions = '0.5';
  assert.equal(Number(basketNutrition(quick).calories), 120);
  assert.equal(basketNutrition(quick).protein, '');
  const food = catalogData.find(food => food.name === 'Bananas, raw');
  const items = [quick, { id: 'fruit', food, grams: '100' }];
  const meal = catalogMeal(items, 'alice', '2026-07-08T12:00', 'lunch');
  assert.deepEqual(meal.rows.map(row => row.calories), [120, 89]);
  assert.equal(meal.rows[0].raw_text_input, 'Lunch label · 0.5× entered amount');
  assert.equal(meal.rows[0].protein_g, null);
  assert.equal(meal.rows[0].fiber_g, 0);
  const draft = { version: 1, userId: 'alice', day: '2026-07-08', when: '2026-07-08T12:00', mealType: 'lunch', items };
  assert.deepEqual(parseCatalogDraft(JSON.stringify(draft), 'alice', draft.day).items, items);
  assert.throws(() => quickBasketPortion('', { calories: '10' }));
  assert.throws(() => quickBasketPortion('Food', { calories: '-1' }));
  assert.equal(parseCatalogDraft(JSON.stringify({ ...draft, items: [{ ...quick, quick: { ...quick.quick, protein_g: 'bad' } }] }), 'alice', draft.day), null);
  assert.throws(() => catalogMeal([{ ...quick, portions: '0' }], 'alice', '2026-07-08T12:00', 'lunch'));
});

test('finished and discarded baskets do not restore stale meal times as active drafts', () => {
  const draft = { version: 1, userId: 'alice', day: '2026-07-08', when: '2026-07-08T08:00', mealType: 'breakfast', items: [] };
  assert.equal(activeCatalogDraft(JSON.stringify(draft), 'alice', draft.day), null);
  assert.equal(activeCatalogDraft(null, 'alice', draft.day), null);
  draft.items.push(quickBasketPortion('Breakfast', { calories: '200' }));
  assert.equal(activeCatalogDraft(JSON.stringify(draft), 'alice', draft.day).when, '2026-07-08T08:00');
});

test('basket preview distinguishes partial, wholly unknown and measured-zero nutrients', () => {
  const first = quickBasketPortion('Label one', { calories: '100', protein: '5', carbs: '', fat: '0', fiber: '' });
  const second = quickBasketPortion('Label two', { calories: '50', protein: '', carbs: '10', fat: '0', fiber: '' });
  second.portions = '2';
  const totals = basketTotals([first, second]);
  assert.equal(totals.calories, 200);
  assert.deepEqual(totals.nutrients.protein, { total: 5, missing: 1 });
  assert.deepEqual(totals.nutrients.carbs, { total: 20, missing: 1 });
  assert.deepEqual(totals.nutrients.fat, { total: 0, missing: 0 });
  assert.deepEqual(totals.nutrients.fiber, { total: 0, missing: 2 });
  assert.throws(() => basketTotals([{ ...first, portions: '' }]));
});

import { quickWaterEntry } from '../src/lib/quickWater.ts';
test('dashboard water shortcuts preserve selected diary day, ownership and positive container amounts', () => {
  const entry = quickWaterEntry('alice', '2026-07-08', 330);
  assert.equal(entry.row.logged_at, '2026-07-08T10:00:00.000Z');
  assert.equal(entry.row.user_id, 'alice');
  assert.equal(entry.row.amount_ml, 330);
  assert.equal(entry.operation, 'add');
  assert.notEqual(entry.row.id, quickWaterEntry('alice', '2026-07-08', 330).row.id);
  assert.throws(() => quickWaterEntry('', '2026-07-08', 330));
  assert.throws(() => quickWaterEntry('alice', '2099-07-08', 330));
  assert.throws(() => quickWaterEntry('alice', '2026-07-08', 0));
  assert.equal(localDateISO(new Date(quickWaterEntry('alice', localDateISO(), 250).row.logged_at)), localDateISO());
});

test('quick water undo removes only the latest addition after offline reload', async () => {
  const earlier = quickWaterEntry('alice', '2026-07-08', 250);
  const latest = quickWaterEntry('alice', '2026-07-08', 500);
  await mutate(WATER_MUTATION_KEY, earlier);
  onlineManager.setOnline(false);
  mutate(WATER_MUTATION_KEY, latest);
  await tick();
  mutate(WATER_MUTATION_KEY, { operation: 'delete', row: latest.row });
  await tick();
  const resumed = client(); hydrate(resumed, dehydrate(qc));
  onlineManager.setOnline(true); await resumed.resumePausedMutations();
  assert.ok(database.rows.has(`water_logs:${earlier.row.id}`));
  assert.equal(database.rows.has(`water_logs:${latest.row.id}`), false);
  resumed.clear();
});

test('completed basket logging preserves foods added or edited while the request was pending', () => {
  const submitted = quickBasketPortion('Initial food', { calories: '100' });
  const later = quickBasketPortion('Added in another tab', { calories: '50' });
  assert.deepEqual(remainingBasketAfterLog([submitted, later], [submitted]), [later]);
  const changed = { ...submitted, portions: '2' };
  assert.deepEqual(remainingBasketAfterLog([changed], [submitted]), [changed]);
  assert.deepEqual(remainingBasketAfterLog([JSON.parse(JSON.stringify(submitted))], [submitted]), []);
  assert.deepEqual(remainingBasketAfterLog([], [submitted]), []);
});

test('logging streaks cross years and DST without row-limit or one-year truncation', async () => {
  const { loadLogStreak } = await import('../src/lib/logStreak.ts');
  const { addDays } = await import('../src/lib/utils.ts');
  const today = '2026-04-01';
  const days = Array.from({length: 1200}, (_, i) => localDateISO(addDays(new Date(`${today}T12:00:00`), -i)));
  let calls = 0;
  const fetch = async (start, end) => { calls++; return days.filter(day => day >= start && day <= end); };
  assert.equal(await loadLogStreak(fetch, today), 1200);
  assert.equal(calls, 4);
  assert.equal(await loadLogStreak(async (start, end) => (await fetch(start, end)).filter(day => day !== today), today), 1199);
  assert.equal(await loadLogStreak(async () => ['2026-04-01','2026-03-30'], today), 1);
  assert.equal(await loadLogStreak(async () => ['2026-03-30'], today), 0);
  assert.equal(await loadLogStreak(async () => [], today), 0);
  await assert.rejects(loadLogStreak(async () => { throw new Error('Unavailable'); }, today), /Unavailable/);
});

test('library search handles accents, punctuation and multiple unordered word prefixes', async () => {
  const { matchesLibrarySearch } = await import('../src/lib/librarySearch.ts');
  assert.equal(matchesLibrarySearch('creme avo', 'Avocado · crème fraîche'), true);
  assert.equal(matchesLibrarySearch('rice bowl', 'Lunch bowl: brown-rice and beans'), true);
  assert.equal(matchesLibrarySearch('rice salmon', 'Rice bowl with beans'), false);
  assert.equal(matchesLibrarySearch('   ', 'Any saved food'), true);
  assert.equal(matchesLibrarySearch('pea', 'Chickpeas'), false);
});

test('saved meal delete and undo survive offline reload without changing its snapshot or diary', async () => {
  const saved = saveMealSnapshot([{ ...meal, confirmed: true, protein_g: null, carbs_g: 20, fat_g: 0, fiber_g: null }], 'alice', 'Undo breakfast', 'breakfast');
  await mutate(SAVED_MEAL_KEY, { operation: 'add', row: saved });
  onlineManager.setOnline(false);
  const remove = mutate(SAVED_MEAL_KEY, { operation: 'delete', row: saved }); await tick();
  const undo = mutate(SAVED_MEAL_KEY, { operation: 'add', row: saved }); await tick();
  const restored = client(); hydrate(restored, JSON.parse(JSON.stringify(dehydrate(qc))));
  onlineManager.setOnline(true); await restored.resumePausedMutations();
  assert.deepEqual(database.rows.get(`saved_meals:${saved.id}`), saved);
  assert.equal(database.rows.size, 1);
  assert.equal(restored.getQueryData(['saved_meals']).length, 1);
  await qc.resumePausedMutations(); await Promise.all([remove, undo]); restored.clear();
  assert.equal(database.rows.size, 1);
});

test('saved meal preview and logging share scaled values and explicit portion labels', async () => {
  const { savedMealPreview } = await import('../src/lib/savedMeals.ts');
  const saved = saveMealSnapshot([{ ...meal, raw_text_input: 'Rice · 100 g', confirmed: true, protein_g: null, carbs_g: 20, fat_g: 0, fiber_g: null }], 'alice', 'Lunch', 'lunch');
  const preview = savedMealPreview(saved.foods, '0.5');
  const logged = logSavedMeal(saved, 'alice', '0.5', '2026-07-08T12:00', 'lunch').rows[0];
  assert.equal(logged.raw_text_input, '0.5× saved amount · Rice · 100 g');
  assert.equal(logged.calories, preview.calories);
  assert.equal(logged.carbs_g, 10);
  assert.equal(preview.nutrients.find(n => n.key === 'protein_g').missing, 1);
  assert.deepEqual(preview.nutrients.find(n => n.key === 'fat_g'), {key:'fat_g',total:0,missing:0});
  assert.equal(saved.foods[0].name, 'Rice · 100 g');
  for (const amount of ['', '0', '-1', 'Infinity']) assert.throws(() => savedMealPreview(saved.foods, amount));
});

test('measured and repeated food labels preserve the logged quantity independently of source foods', async () => {
  const { measuredFoodName, repeatedFoodName } = await import('../src/lib/tracking.ts');
  assert.equal(measuredFoodName(' Rice bowl ', 150.25), 'Rice bowl · 150.25 g');
  assert.equal(repeatedFoodName('Rice bowl · 150.25 g', '0.5'), '0.5× previous amount · Rice bowl · 150.25 g');
  assert.equal(repeatedFoodName('Rice bowl', '1'), 'Rice bowl');
  for (const value of ['', '0', '-1', 'Infinity']) assert.throws(() => repeatedFoodName('Rice', value));
  assert.throws(() => measuredFoodName('Rice', NaN));
});

test('smart points reward protein and fiber and penalise fat, never going negative', () => {
  // 330 cal / 33 = 10 energy points, before adjustments.
  assert.equal(smartFoodPoints({ calories: 330 }), 10);
  // Protein credit: 330 cal, 60 g protein -> 10 - min(60,60)*0.1 = 4.
  assert.equal(smartFoodPoints({ calories: 330, protein_g: 60 }), 4);
  // Fat penalty: 330 cal, 20 g fat -> 10 + 20*0.25 = 15.
  assert.equal(smartFoodPoints({ calories: 330, fat_g: 20 }), 15);
  // Fiber credit is capped at 15 g: 330 cal, 40 g fiber -> 10 - 15*0.15 = 7.75 -> 8.
  assert.equal(smartFoodPoints({ calories: 330, fiber_g: 40 }), 8);
  // Lean, high-protein food can floor at zero, never negative.
  assert.equal(smartFoodPoints({ calories: 60, protein_g: 30 }), 0);
  // Missing/negative nutrients are treated as zero contribution.
  assert.equal(smartFoodPoints({ calories: 330, protein_g: null, fat_g: -5 }), 10);
});

test('daily points budget tracks the calorie target', () => {
  assert.equal(pointsBudget(2000), 61);
  assert.equal(pointsBudget(1650), 50);
  assert.equal(pointsBudget(0), 0);
  assert.equal(pointsBudget(-100), 0);
});

test('whole fruit and non-starchy vegetables are zero-point; starchy staples and juices are not', () => {
  assert.equal(isZeroPointFood({ category: 'Fruits', name: 'Banana, raw' }), true);
  assert.equal(isZeroPointFood({ category: 'Fruits', name: 'Orange juice, raw' }), false);
  assert.equal(isZeroPointFood({ category: 'Vegetables', name: 'Broccoli, cooked' }), true);
  assert.equal(isZeroPointFood({ category: 'Vegetables', name: 'Potato, boiled' }), false);
  assert.equal(isZeroPointFood({ category: 'Ghanaian', name: 'Jollof rice' }), false);
  assert.equal(isZeroPointFood({ category: 'Grains', name: 'Rice' }), false);
});

test('meal points use the stored value when present and fall back to macros otherwise', () => {
  // Stored zero-point entry stays zero even though its macros would score higher.
  assert.equal(mealPoints({ calories: 330, points: 0 }), 0);
  // No stored value: computed from macros.
  assert.equal(mealPoints({ calories: 330, protein_g: 60, points: null }), 4);
  // A day mixes stored and computed rows.
  assert.equal(dayPoints([{ calories: 330, points: 0 }, { calories: 330, points: null }]), 10);
});
