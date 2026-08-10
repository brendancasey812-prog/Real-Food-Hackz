"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppData,
  Food,
  Macros,
  PlannedMeal,
  Recipe,
  ScannedItem,
} from "./types";
import { seedData } from "./seed";
import { normalizeName, mapCategory, unitForNewFood, convertToUnit } from "./receipt";

interface Totals extends Macros {
  calories: number;
}

interface AppState extends AppData {
  setInventory: (foodId: string, quantity: number) => void;
  addFood: (food: Food, startQty?: number) => void;
  addRecipe: (recipe: Recipe, newFoods?: Food[]) => void;
  removeRecipe: (id: string) => void;
  addPlannedMeal: (meal: PlannedMeal) => void;
  removePlannedMeal: (id: string) => void;
  addManualGrocery: (foodId: string, quantity: number) => void;
  removeManualGrocery: (id: string) => void;
  setGoals: (patch: Partial<AppData["goals"]>) => void;
  /** Merge receipt-scanned items into the kitchen; returns a summary. */
  commitScan: (items: ScannedItem[]) => { merged: number; added: number; skipped: number };
  resetToSeed: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const newId = uid;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedData,

      setInventory: (foodId, quantity) =>
        set((s) => {
          const exists = s.inventory.find((i) => i.foodId === foodId);
          const inventory = exists
            ? s.inventory.map((i) =>
                i.foodId === foodId ? { ...i, quantity: Math.max(0, quantity) } : i,
              )
            : [...s.inventory, { foodId, quantity: Math.max(0, quantity) }];
          return { inventory };
        }),

      addFood: (food, startQty = 0) =>
        set((s) => {
          if (s.foods.some((f) => f.id === food.id)) return s;
          return {
            foods: [...s.foods, food],
            inventory: [...s.inventory, { foodId: food.id, quantity: Math.max(0, startQty) }],
          };
        }),

      addRecipe: (recipe, newFoods = []) =>
        set((s) => {
          const freshFoods = newFoods.filter(
            (nf) => !s.foods.some((f) => f.id === nf.id),
          );
          return {
            foods: [...s.foods, ...freshFoods],
            inventory: [
              ...s.inventory,
              ...freshFoods.map((f) => ({ foodId: f.id, quantity: 0 })),
            ],
            recipes: [...s.recipes, recipe],
          };
        }),

      removeRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.filter((p) => p.recipeId !== id),
        })),

      addPlannedMeal: (meal) => set((s) => ({ plan: [...s.plan, meal] })),

      removePlannedMeal: (id) =>
        set((s) => ({ plan: s.plan.filter((p) => p.id !== id) })),

      addManualGrocery: (foodId, quantity) =>
        set((s) => ({
          manualGroceries: [
            ...s.manualGroceries,
            { id: uid(), foodId, quantity: Math.max(0, quantity) },
          ],
        })),

      removeManualGrocery: (id) =>
        set((s) => ({
          manualGroceries: s.manualGroceries.filter((m) => m.id !== id),
        })),

      setGoals: (patch) => set((s) => ({ goals: { ...s.goals, ...patch } })),

      commitScan: (items) => {
        const s = get();
        const foods = [...s.foods];
        const inventory = [...s.inventory];
        const history = [...s.history];
        const today = new Date().toISOString().slice(0, 10);
        let merged = 0, added = 0, skipped = 0;

        for (const item of items) {
          const norm = normalizeName(item.food);
          const existing = foods.find((f) => normalizeName(f.name) === norm);

          if (existing) {
            // Always log the original scanned quantity/unit for traceability.
            history.push({ id: uid(), foodId: existing.id, date: today, quantity: item.quantity, unit: item.unit, source: "receipt_scan" });

            const add = convertToUnit(item.quantity, item.unit, existing.unit);
            if (add != null) {
              const idx = inventory.findIndex((i) => i.foodId === existing.id);
              if (idx >= 0) inventory[idx] = { ...inventory[idx], quantity: Math.round((inventory[idx].quantity + add) * 100) / 100 };
              else inventory.push({ foodId: existing.id, quantity: add });
              merged++;
            } else {
              skipped++; // unit families don't match — logged, but stock left unchanged
            }

            if (item.variant) {
              const parts = new Set((existing.notes ?? "").split(",").map((x) => x.trim()).filter(Boolean));
              parts.add(item.variant);
              const fi = foods.findIndex((f) => f.id === existing.id);
              foods[fi] = { ...existing, notes: Array.from(parts).join(", ") };
            }
          } else {
            const id = uid();
            const map = mapCategory(item.category);
            const unit = unitForNewFood(item.unit);
            const qty = convertToUnit(item.quantity, item.unit, unit) ?? item.quantity;
            foods.push({
              id, name: item.food, unit, caloriesPerUnit: 0, protein: 0, carbs: 0, fat: 0,
              location: map.location, category: map.category, emoji: map.emoji,
              source: "receipt_scan", notes: item.variant || undefined,
            });
            inventory.push({ foodId: id, quantity: qty });
            history.push({ id: uid(), foodId: id, date: today, quantity: item.quantity, unit: item.unit, source: "receipt_scan" });
            added++;
          }
        }

        set({ foods, inventory, history });
        return { merged, added, skipped };
      },

      resetToSeed: () => set({ ...seedData }),
    }),
    { name: "mealplan-store-v6" },
  ),
);

// ---- Derived selectors (the "everything stays in sync" logic) ----

export function foodById(foods: Food[], id: string) {
  return foods.find((f) => f.id === id);
}

/** Calories contributed by one ingredient line (quantity × per-unit calories). */
export function ingredientCalories(
  ing: { foodId: string; quantity: number },
  foods: Food[],
): number {
  const food = foodById(foods, ing.foodId);
  return food ? Math.round(food.caloriesPerUnit * ing.quantity) : 0;
}

/** Total calories for the whole recipe (all servings). */
export function recipeTotalCalories(recipe: Recipe, foods: Food[]): number {
  return recipe.ingredients.reduce(
    (sum, ing) => sum + ingredientCalories(ing, foods),
    0,
  );
}

/** Calories for one serving of a recipe, derived from its ingredients. */
export function recipeCaloriesPerServing(recipe: Recipe, foods: Food[]): number {
  return Math.round(recipeTotalCalories(recipe, foods) / recipe.servings);
}

/** Full macro + calorie totals for one serving of a recipe. */
export function recipeTotalsPerServing(recipe: Recipe, foods: Food[]): Totals {
  const t = recipe.ingredients.reduce(
    (acc, ing) => {
      const food = foodById(foods, ing.foodId);
      if (!food) return acc;
      acc.calories += food.caloriesPerUnit * ing.quantity;
      acc.protein += food.protein * ing.quantity;
      acc.carbs += food.carbs * ing.quantity;
      acc.fat += food.fat * ing.quantity;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const s = recipe.servings || 1;
  return {
    calories: Math.round(t.calories / s),
    protein: Math.round(t.protein / s),
    carbs: Math.round(t.carbs / s),
    fat: Math.round(t.fat / s),
  };
}

/** Combined calorie + macro totals for a set of planned meals. */
export function plannedTotals(
  meals: PlannedMeal[],
  recipes: Recipe[],
  foods: Food[],
): Totals {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    if (!recipe) continue;
    const per = recipeTotalsPerServing(recipe, foods);
    acc.calories += per.calories * meal.servings;
    acc.protein += per.protein * meal.servings;
    acc.carbs += per.carbs * meal.servings;
    acc.fat += per.fat * meal.servings;
  }
  return acc;
}

/** Total quantity of each food required by a set of planned meals. */
export function neededQuantities(
  meals: PlannedMeal[],
  recipes: Recipe[],
): Record<string, number> {
  const need: Record<string, number> = {};
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    if (!recipe) continue;
    const factor = meal.servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      need[ing.foodId] = (need[ing.foodId] ?? 0) + ing.quantity * factor;
    }
  }
  return need;
}
