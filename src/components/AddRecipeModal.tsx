"use client";

import { useMemo, useState } from "react";
import { X, Flame, Trash2 } from "lucide-react";
import { useApp, newId, foodById, componentCalories } from "@/lib/store";
import { UNITS, unitLabel } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import { FoodPicker, NEW_FOOD } from "./FoodPicker";
import type { Food, FoodCategory, Location, MealType, Recipe, RecipeComponent, Unit } from "@/lib/types";

const NEW = NEW_FOOD;

interface Row {
  foodId: string; // existing food id or NEW
  quantity: number;
  newName: string;
  newUnit: Unit;
  newCalories: number;
  newProtein: number;
  newCarbs: number;
  newFat: number;
  newLocation: Location;
  newCategory: FoodCategory;
}

const emptyRow = (foodId: string): Row => ({
  foodId, quantity: 1, newName: "", newUnit: "each",
  newCalories: 50, newProtein: 0, newCarbs: 0, newFat: 0, newLocation: "fridge", newCategory: "vegetable"
});

/** Build or edit a recipe by hand — ingredients, sub-recipes, and steps. */
export function AddRecipeModal({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { foods, recipes, addRecipe, updateRecipe, addFood } = useApp();
  const editing = !!recipe;
  const [name, setName] = useState(recipe?.name ?? "");
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [mealCat, setMealCat] = useState<MealType>(recipe?.category ?? "breakfast");
  const [rows, setRows] = useState<Row[]>(
    recipe && recipe.ingredients.length
      ? recipe.ingredients.map((ing) => ({ ...emptyRow(ing.foodId), quantity: ing.quantity }))
      : [emptyRow(foods[0]?.id ?? NEW)],
  );
  const [components, setComponents] = useState<RecipeComponent[]>(recipe?.components ?? []);
  const [steps, setSteps] = useState((recipe?.steps ?? []).join("\n"));

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Recipes that can be folded in: everything except this one and ones already added.
  const availableRecipes = recipes.filter((r) => !r.single && r.id !== recipe?.id && !components.some((c) => c.recipeId === r.id));

  const { total, perServing } = useMemo(() => {
    const ingT = rows.reduce((sum, row) => {
      const calPerUnit = row.foodId === NEW ? row.newCalories : foodById(foods, row.foodId)?.caloriesPerUnit ?? 0;
      return sum + calPerUnit * row.quantity;
    }, 0);
    const compT = components.reduce((sum, c) => sum + componentCalories(c, foods, recipes), 0);
    const t = ingT + compT;
    return { total: Math.round(t), perServing: Math.round(t / Math.max(1, servings)) };
  }, [rows, components, servings, foods, recipes]);

  const save = () => {
    if (!name.trim()) return;
    const newFoods: Food[] = [];
    const ingredients = rows
      .map((row) => {
        if (row.quantity <= 0) return null;
        if (row.foodId === NEW) {
          if (!row.newName.trim()) return null;
          const id = newId();
          newFoods.push({
            id, name: row.newName.trim(), unit: row.newUnit,
            caloriesPerUnit: Math.max(0, row.newCalories), protein: Math.max(0, row.newProtein),
            carbs: Math.max(0, row.newCarbs), fat: Math.max(0, row.newFat),
            location: row.newLocation, category: row.newCategory
          });
          return { foodId: id, quantity: row.quantity };
        }
        return { foodId: row.foodId, quantity: row.quantity };
      })
      .filter((x): x is { foodId: string; quantity: number } => x !== null);

    if (ingredients.length === 0 && components.length === 0) return;
    const built: Recipe = {
      id: recipe?.id ?? newId(),
      name: name.trim(), servings: Math.max(1, servings),
      ingredients,
      components: components.length ? components : undefined,
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      category: mealCat
    };
    if (editing) {
      newFoods.forEach((f) => addFood(f, 0));
      updateRecipe(built);
    } else {
      addRecipe(built, newFoods);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-scrim p-0 md:items-center md:p-4">
      <div className="sheet-max w-full max-w-lg overflow-y-auto scroll-own rounded-t-3xl border border-line bg-page p-6 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editing ? "Edit recipe" : "New recipe"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" className="flex-1 rounded-lg field px-3 py-2" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Servings</span>
              <input type="number" value={servings} onChange={(e) => setServings(Number(e.target.value))} className="w-20 rounded-lg field px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Meal</span>
              <select value={mealCat} onChange={(e) => setMealCat(e.target.value as MealType)} className="rounded-lg field px-2 py-1.5">
                {MEAL_ORDER.map((mt) => <option key={mt} value={mt}>{MEAL_LABEL[mt]}</option>)}
              </select>
            </label>
          </div>

          {/* Include other recipes (sub-recipes) */}
          <div>
            <div className="mb-2 text-sm font-medium text-muted">Include a recipe</div>
            <div className="space-y-2">
              {components.map((c, i) => {
                const sub = recipes.find((r) => r.id === c.recipeId);
                return (
                  <div key={c.recipeId} className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{sub?.name ?? "Unknown recipe"}</span>
                    <input
                      type="number" min={0.5} step={0.5} value={c.servings}
                      onChange={(e) => { const v = Math.max(0.5, Number(e.target.value) || 0.5); setComponents((cs) => cs.map((x, idx) => (idx === i ? { ...x, servings: v } : x))); }}
                      className="w-16 rounded-lg field px-2 py-1 text-right text-sm"
                    />
                    <span className="w-12 shrink-0 text-xs text-muted">serv.</span>
                    <span className="w-14 shrink-0 text-right text-xs text-cal-soft">{componentCalories(c, foods, recipes)} cal</span>
                    <button onClick={() => setComponents((cs) => cs.filter((_, idx) => idx !== i))} className="shrink-0 text-muted hover:text-danger-soft" aria-label="Remove recipe"><Trash2 size={14} /></button>
                  </div>
                );
              })}
              {availableRecipes.length > 0 ? (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) setComponents((cs) => [...cs, { recipeId: e.target.value, servings: 1 }]); }}
                  className="w-full rounded-lg field px-2 py-2 text-sm"
                >
                  <option value="">Add a recipe to this meal…</option>
                  {availableRecipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : (
                <p className="text-xs text-muted">No other recipes available to include.</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-muted">Ingredients</div>
            <div className="space-y-3">
              {rows.map((row, i) => {
                const isNew = row.foodId === NEW;
                const unit = isNew ? row.newUnit : foods.find((f) => f.id === row.foodId)?.unit ?? "each";
                const rowCals = Math.round((isNew ? row.newCalories : foodById(foods, row.foodId)?.caloriesPerUnit ?? 0) * row.quantity);
                return (
                  <div key={i} className="rounded-xl border border-line p-2.5">
                    <div className="flex gap-2">
                      <FoodPicker value={row.foodId} onChange={(v) => update(i, { foodId: v })} newLabel="New ingredient…" placeholder="Select ingredient…" />
                      <input type="number" value={row.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} className="w-16 rounded-lg field px-2 py-1.5 text-sm" />
                      <span className="flex w-12 items-center text-xs text-muted">{unitLabel(unit)}</span>
                    </div>

                    {isNew && (
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-2">
                        <input value={row.newName} onChange={(e) => update(i, { newName: e.target.value })} placeholder="Ingredient name" className="rounded-lg field px-2 py-1.5 text-sm" />
                        <select value={row.newUnit} onChange={(e) => update(i, { newUnit: e.target.value as Unit })} className="rounded-lg field px-2 py-1.5 text-sm">
                          {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                        <input type="number" value={row.newCalories} onChange={(e) => update(i, { newCalories: Number(e.target.value) })} placeholder="cal/unit" className="rounded-lg field px-2 py-1.5 text-sm" />
                        <div className="col-span-2 grid grid-cols-3 gap-2">
                          <input type="number" value={row.newProtein} onChange={(e) => update(i, { newProtein: Number(e.target.value) })} placeholder="protein g" className="rounded-lg field px-2 py-1.5 text-sm" />
                          <input type="number" value={row.newCarbs} onChange={(e) => update(i, { newCarbs: Number(e.target.value) })} placeholder="carbs g" className="rounded-lg field px-2 py-1.5 text-sm" />
                          <input type="number" value={row.newFat} onChange={(e) => update(i, { newFat: Number(e.target.value) })} placeholder="fat g" className="rounded-lg field px-2 py-1.5 text-sm" />
                        </div>
                        <select value={row.newLocation} onChange={(e) => update(i, { newLocation: e.target.value as Location })} className="rounded-lg field px-2 py-1.5 text-sm">
                          <option value="fridge">Store in Fridge</option>
                          <option value="freezer">Store in Freezer</option>
                          <option value="pantry">Store in Pantry</option>
                        </select>
                        <select value={row.newCategory} onChange={(e) => update(i, { newCategory: e.target.value as FoodCategory })} className="rounded-lg field px-2 py-1.5 text-sm">
                          {FOOD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-cal-soft">{rowCals} cal</span>
                      {rows.length > 1 && (
                        <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-[11px] text-muted hover:text-danger-soft">remove</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setRows((rs) => [...rs, emptyRow(foods[0]?.id ?? NEW)])} className="mt-2 text-sm font-medium text-accent-soft hover:text-accent-soft">+ Add ingredient</button>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-muted">Steps (one per line)</div>
            <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder={"Chop the vegetables\nSauté until soft"} className="w-full rounded-lg field px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-cal/12 px-4 py-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-cal-soft"><Flame size={15} /> {perServing} cal / serving</span>
            <span className="text-cal-soft">{total} cal total</span>
          </div>

          <button onClick={save} className="w-full rounded-xl bg-gradient-to-b from-accent to-accent-deep py-3 font-medium text-on-accent shadow-lg hover:brightness-110">{editing ? "Save changes" : "Save recipe"}</button>
        </div>
      </div>
    </div>
  );
}
