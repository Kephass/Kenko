"use client";

import { useState } from "react";
import { Flame, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { useAddDish, useDeleteDish, useDishes, useUpdateDish } from "@/hooks/useDishes";

const EMPTY = {
  name: "",
  calories_per_100g: "",
  protein_g_per_100g: "",
  carbs_g_per_100g: "",
  fat_g_per_100g: "",
  fiber_g_per_100g: "",
  reference_serving_g: "",
};

type FormState = typeof EMPTY;

const NUTRITION_FIELDS = [
  ["calories_per_100g", "Calories / 100g"],
  ["protein_g_per_100g", "Protein g / 100g"],
  ["carbs_g_per_100g", "Carbs g / 100g"],
  ["fat_g_per_100g", "Fat g / 100g"],
  ["fiber_g_per_100g", "Fiber g / 100g"],
] as const;

function toInput(form: FormState) {
  return {
    name: form.name,
    calories_per_100g: Number(form.calories_per_100g),
    protein_g_per_100g: Number(form.protein_g_per_100g) || 0,
    carbs_g_per_100g: Number(form.carbs_g_per_100g) || 0,
    fat_g_per_100g: Number(form.fat_g_per_100g) || 0,
    fiber_g_per_100g: Number(form.fiber_g_per_100g) || 0,
    reference_serving_g: form.reference_serving_g ? Number(form.reference_serving_g) : undefined,
  };
}

export default function DishesPage() {
  const dishes = useDishes();
  const add = useAddDish();
  const update = useUpdateDish();
  const del = useDeleteDish();
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const open = adding || editingId !== null;
  const pending = add.isPending || update.isPending;

  function close() {
    setForm(EMPTY);
    setAdding(false);
    setEditingId(null);
  }

  function startEdit(d: NonNullable<typeof dishes.data>[number]) {
    setEditingId(d.id);
    setAdding(false);
    setForm({
      name: d.name,
      calories_per_100g: String(Number(d.calories_per_100g)),
      protein_g_per_100g: String(Number(d.protein_g_per_100g ?? 0)),
      carbs_g_per_100g: String(Number(d.carbs_g_per_100g ?? 0)),
      fat_g_per_100g: String(Number(d.fat_g_per_100g ?? 0)),
      fiber_g_per_100g: String(Number(d.fiber_g_per_100g ?? 0)),
      reference_serving_g: d.reference_serving_g ? String(Number(d.reference_serving_g)) : "",
    });
  }

  function submit() {
    if (editingId) {
      update.mutate({ id: editingId, edits: toInput(form) }, { onSuccess: close });
    } else {
      add.mutate(toInput(form), { onSuccess: close });
    }
  }

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">My Dishes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your closed set — photo matching only works for dishes in here.
        </p>
      </div>

      {!open && (
        <Button className="h-12 w-full rounded-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add dish
        </Button>
      )}

      {open && (
        <Card className="space-y-4 p-5">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Dish name</Label>
              <Input
                id="name"
                className="h-11 rounded-xl"
                placeholder="e.g. Jollof rice with chicken"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {NUTRITION_FIELDS.map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    className="h-11 rounded-xl"
                    type="number"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="serving">Serving (g, optional)</Label>
                <Input
                  id="serving"
                  className="h-11 rounded-xl"
                  type="number"
                  value={form.reference_serving_g}
                  onChange={(e) => setForm({ ...form, reference_serving_g: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="h-11 flex-1 rounded-full"
                disabled={pending || !form.name || !form.calories_per_100g}
              >
                {editingId ? "Save changes" : "Save dish"}
              </Button>
              <Button type="button" variant="secondary" className="h-11 rounded-full" onClick={close}>
                Cancel
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 rounded-full"
                  disabled={del.isPending}
                  onClick={() => del.mutate(editingId, { onSuccess: close })}
                >
                  Delete
                </Button>
              )}
            </div>
            {(add.isError || update.isError || del.isError) && (
              <p className="text-sm text-destructive">
                {String(add.error ?? update.error ?? del.error)}
              </p>
            )}
          </form>
        </Card>
      )}

      <section className="space-y-3">
        {(dishes.data ?? []).map((d) => (
          <Card
            key={d.id}
            className="flex-row items-center justify-between p-4"
            role="button"
            onClick={() => startEdit(d)}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                <Flame className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(Number(d.calories_per_100g))} cal/100g · P{" "}
                  {Math.round(Number(d.protein_g_per_100g))} · C {Math.round(Number(d.carbs_g_per_100g))} · F{" "}
                  {Math.round(Number(d.fat_g_per_100g))}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {d.embedding ? "matchable" : "no embedding"}
            </Badge>
          </Card>
        ))}
        {dishes.data?.length === 0 && (
          <EmptyState>No dishes yet — add the ones you actually eat on repeat.</EmptyState>
        )}
      </section>
    </div>
  );
}
