"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  useApp,
  recipeCaloriesPerServing,
  foodById,
  newId,
} from "@/lib/store";
import type { RecipeIngredient } from "@/lib/types";

export default function Cookbook() {
  const { recipes, foods, removeRecipe } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cookbook</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {recipes.length} recipes · calories are calculated from ingredients
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> Add recipe
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => (
          <div
            key={r.id}
            className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{r.emoji}</span>
              <button
                onClick={() => removeRecipe(r.id)}
                className="text-zinc-300 hover:text-rose-500"
                aria-label="Delete recipe"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <h3 className="mt-2 font-semibold">{r.name}</h3>
            <div className="mt-1 flex gap-3 text-xs text-zinc-500">
              <span>{recipeCaloriesPerServing(r, foods)} kcal / serving</span>
              <span>· {r.servings} servings</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {r.ingredients.map((ing) => {
                const f = foodById(foods, ing.foodId);
                return (
                  <li key={ing.foodId} className="flex justify-between">
                    <span>
                      {f?.emoji} {f?.name ?? ing.foodId}
                    </span>
                    <span className="text-zinc-400">
                      {ing.quantity} {f?.unit}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {open && <AddRecipeModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddRecipeModal({ onClose }: { onClose: () => void }) {
  const { foods, addRecipe } = useApp();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [servings, setServings] = useState(2);
  const [rows, setRows] = useState<RecipeIngredient[]>([
    { foodId: foods[0]?.id ?? "", quantity: 100 },
  ]);
  const [steps, setSteps] = useState("");

  const update = (i: number, patch: Partial<RecipeIngredient>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = () => {
    if (!name.trim()) return;
    addRecipe({
      id: newId(),
      name: name.trim(),
      emoji,
      servings: Math.max(1, servings),
      ingredients: rows.filter((r) => r.foodId && r.quantity > 0),
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-zinc-900 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New recipe</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-14 rounded-lg border border-zinc-300 bg-transparent px-2 py-2 text-center text-xl dark:border-zinc-700"
            />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipe name"
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Servings</span>
            <input
              type="number"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-20 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
            />
          </label>

          <div>
            <div className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Ingredients
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => {
                const unit = foods.find((f) => f.id === row.foodId)?.unit ?? "";
                return (
                  <div key={i} className="flex gap-2">
                    <select
                      value={row.foodId}
                      onChange={(e) => update(i, { foodId: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                    >
                      {foods.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.emoji} {f.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                    />
                    <span className="flex w-10 items-center text-xs text-zinc-400">
                      {unit}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setRows((rs) => [...rs, { foodId: foods[0]?.id ?? "", quantity: 100 }])}
              className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              + Add ingredient
            </button>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Steps (one per line)
            </div>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={3}
              placeholder={"Chop the vegetables\nSauté until soft"}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
          </div>

          <button
            onClick={save}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700"
          >
            Save recipe
          </button>
        </div>
      </div>
    </div>
  );
}
