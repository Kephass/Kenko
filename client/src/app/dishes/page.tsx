"use client";

import { useState } from "react";
import { useAddDish, useDishes } from "@/hooks/useDishes";

const EMPTY = {
  name: "",
  calories_per_100g: "",
  protein_g_per_100g: "",
  carbs_g_per_100g: "",
  fat_g_per_100g: "",
  reference_serving_g: "",
};

export default function DishesPage() {
  const dishes = useDishes();
  const add = useAddDish();
  const [form, setForm] = useState(EMPTY);

  const input = "w-full rounded border px-3 py-2 dark:bg-neutral-900 dark:border-neutral-700";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dish library</h1>
      <p className="text-sm text-neutral-500">
        Your closed set. Photo matching only works for dishes in here (embeddings are generated
        offline by scripts/generate_dish_embeddings.py).
      </p>

      <form
        className="space-y-2 rounded-lg border p-4 dark:border-neutral-700"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            {
              name: form.name,
              calories_per_100g: Number(form.calories_per_100g),
              protein_g_per_100g: Number(form.protein_g_per_100g) || 0,
              carbs_g_per_100g: Number(form.carbs_g_per_100g) || 0,
              fat_g_per_100g: Number(form.fat_g_per_100g) || 0,
              reference_serving_g: form.reference_serving_g
                ? Number(form.reference_serving_g)
                : undefined,
            },
            { onSuccess: () => setForm(EMPTY) },
          );
        }}
      >
        <input
          className={input}
          placeholder="Dish name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={input}
            type="number"
            placeholder="kcal / 100g"
            value={form.calories_per_100g}
            onChange={(e) => setForm({ ...form, calories_per_100g: e.target.value })}
          />
          <input
            className={input}
            type="number"
            placeholder="protein g / 100g"
            value={form.protein_g_per_100g}
            onChange={(e) => setForm({ ...form, protein_g_per_100g: e.target.value })}
          />
          <input
            className={input}
            type="number"
            placeholder="carbs g / 100g"
            value={form.carbs_g_per_100g}
            onChange={(e) => setForm({ ...form, carbs_g_per_100g: e.target.value })}
          />
          <input
            className={input}
            type="number"
            placeholder="fat g / 100g"
            value={form.fat_g_per_100g}
            onChange={(e) => setForm({ ...form, fat_g_per_100g: e.target.value })}
          />
        </div>
        <input
          className={input}
          type="number"
          placeholder="Typical serving (g), optional"
          value={form.reference_serving_g}
          onChange={(e) => setForm({ ...form, reference_serving_g: e.target.value })}
        />
        <button
          className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={add.isPending || !form.name || !form.calories_per_100g}
        >
          Add dish
        </button>
        {add.isError && <p className="text-sm text-red-600">{String(add.error)}</p>}
      </form>

      <ul className="space-y-2">
        {(dishes.data ?? []).map((d) => (
          <li key={d.id} className="rounded-lg border p-3 text-sm dark:border-neutral-700">
            <div className="flex justify-between">
              <span className="font-medium">{d.name}</span>
              <span className="tabular-nums text-neutral-500">
                {Number(d.calories_per_100g)} kcal/100g
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-neutral-500 tabular-nums">
              <span>
                P {Number(d.protein_g_per_100g)} · C {Number(d.carbs_g_per_100g)} · F{" "}
                {Number(d.fat_g_per_100g)}
              </span>
              <span>{d.embedding ? "matchable" : "no embedding yet"}</span>
            </div>
          </li>
        ))}
      </ul>
      {dishes.data?.length === 0 && (
        <p className="text-sm text-neutral-500">No dishes yet - add the ones you actually eat on repeat.</p>
      )}
    </div>
  );
}
