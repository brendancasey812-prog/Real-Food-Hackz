"use client";

import { useState } from "react";
import { X, Pencil, Flame, Trash2, Plus, Search, Check, ArrowLeft } from "lucide-react";
import {
  useApp, newId, foodById, ingredientCalories,
} from "@/lib/store";
import { pluralUnit, fmtQty } from "@/lib/units";
import { mealStart, clockLabel } from "@/lib/mealtime";
import { MEAL_LABEL } from "@/lib/week";
import type { Food, RecipeIngredient } from "@/lib/types";

interface Draft {
  name: string;
  emoji: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

export function MealDetailModal({ mealId, onClose }: { mealId: string; onClose: () => void }) {
  const { plan, recipes, foods, addRecipe, updateRecipe, updatePlannedMeal } = useApp();
  const meal = plan.find((m) => m.id === mealId);
  const recipe = recipes.find((r) => r.id === meal?.recipeId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savePrompt, setSavePrompt] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  if (!meal || !recipe) {
    // Meal or recipe vanished (e.g. deleted) — nothing to show.
    return null;
  }

  const startEdit = () => {
    setDraft({
      name: recipe.name,
      emoji: recipe.emoji,
      servings: recipe.servings,
      ingredients: recipe.ingredients.map((i) => ({ ...i })),
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraft(null); setSavePrompt(false); setAdding(false); setQuery(""); };

  const patchDraft = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setQty = (i: number, q: number) =>
    setDraft((d) => (d ? { ...d, ingredients: d.ingredients.map((it, idx) => (idx === i ? { ...it, quantity: q } : it)) } : d));
  const removeIng = (i: number) =>
    setDraft((d) => (d ? { ...d, ingredients: d.ingredients.filter((_, idx) => idx !== i) } : d));
  const addIng = (foodId: string) => {
    setDraft((d) => (d && !d.ingredients.some((x) => x.foodId === foodId)
      ? { ...d, ingredients: [...d.ingredients, { foodId, quantity: 1 }] } : d));
    setAdding(false); setQuery("");
  };

  const saveExisting = () => {
    if (!draft) return;
    updateRecipe({ ...recipe, name: draft.name.trim() || recipe.name, emoji: draft.emoji || "🍽️", servings: Math.max(1, draft.servings), ingredients: draft.ingredients });
    onClose();
  };
  const saveAsNew = () => {
    if (!draft) return;
    const id = newId();
    addRecipe({ id, name: (draft.name.trim() || recipe.name), emoji: draft.emoji || "🍽️", servings: Math.max(1, draft.servings), ingredients: draft.ingredients, steps: recipe.steps, category: recipe.category });
    updatePlannedMeal(meal.id, { recipeId: id });
    onClose();
  };

  // ---- rows to display (view = recipe, edit = draft) ----
  const rows = editing && draft ? draft.ingredients : recipe.ingredients;
  const total = rows.reduce((s, ing) => s + ingredientCalories(ing, foods), 0);
  const servings = editing && draft ? Math.max(1, draft.servings) : recipe.servings;
  const perServing = Math.round(total / servings);

  const q = query.trim().toLowerCase();
  const addable = foods
    .filter((f) => !((editing && draft) ? draft.ingredients : recipe.ingredients).some((x) => x.foodId === f.id))
    .filter((f) => (q ? f.name.toLowerCase().includes(q) : true));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 md:rounded-2xl">
        {/* Header: Edit (top-left) · title · Close (top-right) */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
          {editing ? (
            <button onClick={cancelEdit} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.06]">
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10">
              <Pencil size={15} /> Edit
            </button>
          )}
          <span className="truncate text-sm font-semibold text-zinc-200">{editing ? "Edit meal" : MEAL_LABEL[meal.mealType]}</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Title / meta */}
          {editing && draft ? (
            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <input value={draft.emoji} onChange={(e) => patchDraft({ emoji: e.target.value })} className="w-14 rounded-lg field px-2 py-2 text-center text-xl" />
                <input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} className="flex-1 rounded-lg field px-3 py-2 font-medium" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Servings</span>
                <input type="number" min={1} value={draft.servings} onChange={(e) => patchDraft({ servings: Number(e.target.value) || 1 })} className="w-20 rounded-lg field px-2 py-1.5" />
              </label>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">{recipe.emoji}</span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{recipe.name}</h3>
                <p className="text-xs text-zinc-500">
                  {clockLabel(mealStart(meal))} · {recipe.servings} serving{recipe.servings > 1 ? "s" : ""}
                  {meal.servings !== 1 && ` · ${meal.servings}× on the plan`}
                </p>
              </div>
            </div>
          )}

          {/* Ingredient list */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Ingredients</span>
            <span className="text-xs text-zinc-500">{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/[0.07]">
            {rows.length === 0 && <p className="px-3 py-4 text-center text-xs text-zinc-500">No ingredients.</p>}
            {rows.map((ing, i) => {
              const f = foodById(foods, ing.foodId);
              const cal = ingredientCalories(ing, foods);
              return (
                <div key={ing.foodId} className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2.5 text-sm last:border-0">
                  <span className="shrink-0">{f?.emoji ?? "🍽️"}</span>
                  <span className="min-w-0 flex-1 truncate">{f?.name ?? ing.foodId}</span>
                  {editing && draft ? (
                    <>
                      <input
                        type="number" min={0} step={0.25} value={ing.quantity}
                        onChange={(e) => setQty(i, Math.max(0, Number(e.target.value) || 0))}
                        className="w-16 rounded-lg field px-2 py-1 text-right text-sm"
                      />
                      <span className="w-10 shrink-0 text-xs text-zinc-500">{f ? pluralUnit(ing.quantity, f.unit) : ""}</span>
                      <span className="w-14 shrink-0 text-right text-xs text-rose-400/80">{cal} cal</span>
                      <button onClick={() => removeIng(i)} className="shrink-0 text-zinc-500 hover:text-rose-400" aria-label="Remove ingredient"><Trash2 size={14} /></button>
                    </>
                  ) : (
                    <span className="shrink-0 text-right text-zinc-400">
                      {fmtQty(ing.quantity)} {f ? pluralUnit(ing.quantity, f.unit) : ""}
                      {" · "}<span className="text-rose-400/80">{cal} cal</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add ingredient (edit mode) */}
          {editing && draft && (
            <div className="mt-2">
              {adding ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                  <div className="relative mb-1.5">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ingredients…" className="w-full rounded-lg field py-1.5 pl-8 pr-2 text-sm" />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {addable.length === 0 && <p className="px-2 py-3 text-center text-xs text-zinc-500">No matching ingredients.</p>}
                    {addable.slice(0, 40).map((f: Food) => (
                      <button key={f.id} onClick={() => addIng(f.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10">
                        <span>{f.emoji}</span> <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300">
                  <Plus size={15} /> Add ingredient
                </button>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-rose-950/30 px-4 py-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-rose-300"><Flame size={15} /> {perServing} cal / serving</span>
            <span className="text-rose-400/70">{total} cal total ({servings} serving{servings > 1 ? "s" : ""})</span>
          </div>
        </div>

        {/* Footer actions */}
        {editing && draft && (
          <div className="border-t border-white/[0.07] p-4">
            {savePrompt ? (
              <div className="space-y-2">
                <p className="text-center text-sm text-zinc-400">Save your changes as…</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button onClick={saveExisting} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]">
                    <Check size={15} /> Update this meal
                  </button>
                  <button onClick={saveAsNew} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">
                    <Plus size={15} /> Save as new meal
                  </button>
                </div>
                <button onClick={() => setSavePrompt(false)} className="w-full py-1 text-center text-xs text-zinc-500 hover:text-zinc-300">Keep editing</button>
                <p className="text-center text-[11px] leading-4 text-zinc-500">
                  “Update” changes this recipe everywhere it’s planned. “Save as new” makes a copy and points just this calendar entry at it.
                </p>
              </div>
            ) : (
              <button onClick={() => setSavePrompt(true)} className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">
                Save changes
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
