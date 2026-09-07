"use client";

import { useState } from "react";
import { X, Pencil, Flame, Trash2, Plus, Search, Check, ArrowLeft } from "lucide-react";
import {
  useApp, newId, foodById, ingredientCalories, componentCalories
} from "@/lib/store";
import { householdSize, householdName, portionsFor, portionNote, scaleRecipe } from "@/lib/household";
import { ServingsStepper } from "./ServingsStepper";
import { pluralUnit, fmtQty } from "@/lib/units";
import { ingredientCost, recipeCostPerServing, fmtMoney } from "@/lib/cost";
import { FoodSheet } from "./FoodSheet";
import { mealStart, clockLabel } from "@/lib/mealtime";
import { MEAL_LABEL } from "@/lib/week";
import type { Food, RecipeIngredient, RecipeComponent } from "@/lib/types";

interface Draft {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  components: RecipeComponent[];
}

export function MealDetailModal({ mealId, onClose }: { mealId: string; onClose: () => void }) {
  const {
    plan, recipes, foods, addRecipe, updateRecipe, updatePlannedMeal,
    householdMode, members, prices, selectedStoreId, inventory, setInventory,
  } = useApp();
  const meal = plan.find((m) => m.id === mealId);
  const recipe = recipes.find((r) => r.id === meal?.recipeId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savePrompt, setSavePrompt] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  // Tapping an ingredient opens the food, where its price at every shop is.
  const [openFood, setOpenFood] = useState<string | null>(null);

  if (!meal || !recipe) {
    // Meal or recipe vanished (e.g. deleted) — nothing to show.
    return null;
  }

  const startEdit = () => {
    setDraft({
      name: recipe.name,
      servings: recipe.servings,
      ingredients: recipe.ingredients.map((i) => ({ ...i })),
      components: (recipe.components ?? []).map((c) => ({ ...c }))
    });
    setEditing(true);
  };

  const size = householdSize({ householdMode, members });
  const portions = portionsFor(recipe, size);

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
  const setCompServings = (i: number, s: number) =>
    setDraft((d) => (d ? { ...d, components: d.components.map((c, idx) => (idx === i ? { ...c, servings: s } : c)) } : d));
  const removeComp = (i: number) =>
    setDraft((d) => (d ? { ...d, components: d.components.filter((_, idx) => idx !== i) } : d));
  const addComp = (recipeId: string) =>
    setDraft((d) => (d && !d.components.some((c) => c.recipeId === recipeId)
      ? { ...d, components: [...d.components, { recipeId, servings: 1 }] } : d));

  const saveExisting = () => {
    if (!draft) return;
    updateRecipe({ ...recipe, name: draft.name.trim() || recipe.name, servings: Math.max(1, draft.servings), ingredients: draft.ingredients, components: draft.components.length ? draft.components : undefined });
    onClose();
  };
  const saveAsNew = () => {
    if (!draft) return;
    const id = newId();
    addRecipe({ id, name: (draft.name.trim() || recipe.name), servings: Math.max(1, draft.servings), ingredients: draft.ingredients, components: draft.components.length ? draft.components : undefined, steps: recipe.steps, category: recipe.category });
    updatePlannedMeal(meal.id, { recipeId: id });
    onClose();
  };

  // ---- rows to display (view = recipe, edit = draft) ----
  const rows = editing && draft ? draft.ingredients : recipe.ingredients;
  const comps = editing && draft ? draft.components : (recipe.components ?? []);
  const ingTotal = rows.reduce((s, ing) => s + ingredientCalories(ing, foods), 0);
  const compTotal = comps.reduce((s, c) => s + componentCalories(c, foods, recipes), 0);
  const total = ingTotal + compTotal;
  const servings = editing && draft ? Math.max(1, draft.servings) : recipe.servings;
  const perServing = Math.round(total / servings);

  const q = query.trim().toLowerCase();
  const addable = foods
    .filter((f) => !((editing && draft) ? draft.ingredients : recipe.ingredients).some((x) => x.foodId === f.id))
    .filter((f) => (q ? f.name.toLowerCase().includes(q) : true));
  const addableRecipes = recipes.filter((rr) => rr.id !== recipe.id && !comps.some((c) => c.recipeId === rr.id));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl">
        {/* Header: Edit (top-left) · title · Close (top-right) */}
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          {editing ? (
            <button onClick={cancelEdit} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-3">
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-accent-soft hover:bg-accent-wash">
              <Pencil size={15} /> Edit
            </button>
          )}
          <span className="truncate text-sm font-semibold text-ink">{editing ? "Edit meal" : MEAL_LABEL[meal.mealType]}</span>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Title / meta */}
          {editing && draft ? (
            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} className="flex-1 rounded-lg field px-3 py-2 font-medium" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Servings</span>
                <input type="number" min={1} value={draft.servings} onChange={(e) => patchDraft({ servings: Number(e.target.value) || 1 })} className="w-20 rounded-lg field px-2 py-1.5" />
              </label>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{recipe.name}</h3>
                <p className="text-xs text-muted">
                  {clockLabel(mealStart(meal))} · the recipe makes {portionNote(portions)}
                </p>
                {(() => {
                  const per = recipeCostPerServing(recipe, recipes, prices, selectedStoreId);
                  if (per.priced === 0) return null;
                  const short = per.lines - per.priced;
                  return (
                    <p className="mt-0.5 text-xs text-accent-soft">
                      {fmtMoney(per.cost)} a serving · {fmtMoney(per.cost * meal.servings)} for
                      the {meal.servings} on this day
                      {short > 0 && (
                        <span className="ml-1 text-warn-soft">
                          ({short} ingredient{short === 1 ? "" : "s"} unpriced)
                        </span>
                      )}
                    </p>
                  );
                })()}
              </div>

              {/* Portions, right here — the number you actually change most */}
              <ServingsStepper
                label="Portions on this day"
                value={meal.servings}
                onChange={(v) => updatePlannedMeal(meal.id, { servings: Math.max(1, Math.round(v)) })}
                hint={
                  <>
                    {(perServing * meal.servings).toLocaleString()} cal
                    {size > 1 && ` · ${Math.round((perServing * meal.servings) / size).toLocaleString()} each`}
                  </>
                }
                household={size}
                householdLabel={size === 1 ? undefined : householdName({ householdMode, members })}
              />

              {/* And the recipe's own yield, if a batch doesn't cover the table */}
              {size > 1 && recipe.servings !== portions.suggested && (
                <button
                  onClick={() => updateRecipe(scaleRecipe(recipe, portions.suggested))}
                  className="w-full rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-3"
                >
                  Scale the recipe itself to {portions.suggested} servings — enough for{" "}
                  {householdName({ householdMode, members })}
                </button>
              )}
            </div>
          )}

          {/* Included recipes (sub-recipes) */}
          {(comps.length > 0 || (editing && draft && addableRecipes.length > 0)) && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-muted">Included recipes</div>
              <div className="overflow-hidden rounded-xl border border-accent">
                {comps.map((c, i) => {
                  const sub = recipes.find((r) => r.id === c.recipeId);
                  const cal = componentCalories(c, foods, recipes);
                  return (
                    <div key={c.recipeId} className="flex items-center gap-2 border-b border-line px-3 py-2.5 text-sm last:border-0">
                      <span className="min-w-0 flex-1 truncate font-medium text-accent-soft">{sub?.name ?? "Unknown recipe"}</span>
                      {editing && draft ? (
                        <>
                          <input type="number" min={0.5} step={0.5} value={c.servings} onChange={(e) => setCompServings(i, Math.max(0.5, Number(e.target.value) || 0.5))} className="w-16 rounded-lg field px-2 py-1 text-right text-sm" />
                          <span className="w-10 shrink-0 text-xs text-muted">serv.</span>
                          <span className="w-14 shrink-0 text-right text-xs text-cal-soft">{cal} cal</span>
                          <button onClick={() => removeComp(i)} className="shrink-0 text-muted hover:text-danger-soft" aria-label="Remove recipe"><Trash2 size={14} /></button>
                        </>
                      ) : (
                        <span className="shrink-0 text-right text-muted">{fmtQty(c.servings)} serv · <span className="text-cal-soft">{cal} cal</span></span>
                      )}
                    </div>
                  );
                })}
                {comps.length === 0 && <p className="px-3 py-2.5 text-center text-xs text-muted">No recipes included yet.</p>}
              </div>
              {editing && draft && addableRecipes.length > 0 && (
                <select value="" onChange={(e) => { if (e.target.value) addComp(e.target.value); }} className="mt-2 w-full rounded-lg field px-2 py-2 text-sm">
                  <option value="">Add a recipe to this meal…</option>
                  {addableRecipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Ingredient list */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Ingredients</span>
            <span className="text-xs text-muted">{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            {rows.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">No ingredients.</p>}
            {rows.map((ing, i) => {
              const f = foodById(foods, ing.foodId);
              const cal = ingredientCalories(ing, foods);
              return (
                <div key={ing.foodId} className="flex items-center gap-2 border-b border-line px-3 py-2.5 text-sm last:border-0">
                  {editing || !f ? (
                    <span className="min-w-0 flex-1 truncate">{f?.name ?? ing.foodId}</span>
                  ) : (
                    <button
                      onClick={() => setOpenFood(f.id)}
                      className="min-w-0 flex-1 truncate text-left hover:text-accent-soft"
                      title={`Open ${f.name} — its price at every shop, calories, and where it's kept`}
                    >
                      {f.name}
                    </button>
                  )}
                  {editing && draft ? (
                    <>
                      <input
                        type="number" min={0} step={0.25} value={ing.quantity}
                        onChange={(e) => setQty(i, Math.max(0, Number(e.target.value) || 0))}
                        className="w-16 rounded-lg field px-2 py-1 text-right text-sm"
                      />
                      <span className="w-10 shrink-0 text-xs text-muted">{f ? pluralUnit(ing.quantity, f.unit) : ""}</span>
                      <span className="w-14 shrink-0 text-right text-xs text-cal-soft">{cal} cal</span>
                      <button onClick={() => removeIng(i)} className="shrink-0 text-muted hover:text-danger-soft" aria-label="Remove ingredient"><Trash2 size={14} /></button>
                    </>
                  ) : (
                    <span className="shrink-0 text-right text-muted">
                      {fmtQty(ing.quantity)} {f ? pluralUnit(ing.quantity, f.unit) : ""}
                      {" · "}<span className="text-cal-soft">{cal} cal</span>
                      {(() => {
                        const c = ingredientCost(ing, prices, selectedStoreId);
                        return c != null ? (
                          <span className="text-accent-soft"> · {fmtMoney(c)}</span>
                        ) : (
                          <span className="text-warn-soft"> · no price</span>
                        );
                      })()}
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
                <div className="rounded-xl border border-line bg-surface p-2">
                  <div className="relative mb-1.5">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ingredients…" className="w-full rounded-lg field py-1.5 pl-8 pr-2 text-sm" />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {addable.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted">No matching ingredients.</p>}
                    {addable.slice(0, 40).map((f: Food) => (
                      <button key={f.id} onClick={() => addIng(f.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-accent-wash">
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-medium text-accent-soft hover:text-accent-soft">
                  <Plus size={15} /> Add ingredient
                </button>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-cal/12 px-4 py-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-cal-soft"><Flame size={15} /> {perServing} cal / serving</span>
            <span className="text-cal-soft">{total} cal total ({servings} serving{servings > 1 ? "s" : ""})</span>
          </div>
        </div>

        {/* Footer actions */}
        {editing && draft && (
          <div className="border-t border-line p-4">
            {savePrompt ? (
              <div className="space-y-2">
                <p className="text-center text-sm text-muted">Save your changes as…</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button onClick={saveExisting} className="flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm font-medium text-ink hover:bg-surface-3">
                    <Check size={15} /> Update this meal
                  </button>
                  <button onClick={saveAsNew} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
                    <Plus size={15} /> Save as new meal
                  </button>
                </div>
                <button onClick={() => setSavePrompt(false)} className="w-full py-1 text-center text-xs text-muted hover:text-ink-2">Keep editing</button>
                <p className="text-center text-[11px] leading-4 text-muted">
                  “Update” changes this recipe everywhere it’s planned. “Save as new” makes a copy and points just this calendar entry at it.
                </p>
              </div>
            ) : (
              <button onClick={() => setSavePrompt(true)} className="w-full rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
                Save changes
              </button>
            )}
          </div>
        )}
      </div>

      {openFood && (() => {
        const f = foodById(foods, openFood);
        return f ? (
          <FoodSheet
            food={f}
            quantity={inventory.find((i) => i.foodId === f.id)?.quantity ?? 0}
            onQuantity={(v) => setInventory(f.id, v)}
            onClose={() => setOpenFood(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
