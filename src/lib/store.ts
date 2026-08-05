"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppData,
  Food,
  PlannedMeal,
  Recipe,
} from "./types";
import { seedData } from "./seed";

interface AppState extends AppData {
  // Inventory
  setInventory: (foodId: string, quantity: number) => void;
  // Foods — adding a food makes it show up in the Kitchen and available to recipes.
  addFood: (food: Food, startQty?: number) => void;
  // Recipes — new ingredient foods are created alongside the recipe.
  addRecipe: (recipe: Recipe, newFoods?: Food[]) => void;
  removeRecipe: (id: string) => void;
  // Plan
  addPlannedMeal: (meal: PlannedMeal) => void;
  removePlannedMeal: (id: string) => void;
  // Manual grocery items
  addManualGrocery: (foodId: string, quantity: number) => void;
  removeManualGrocery: (id: string) => void;
  // Goals
  setDailyCalorieTarget: (target: number) => void;
  // Utilities
  resetToSeed: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const newId = uid;

export const useApp = create<AppState>()(
  persist(
    (set) => ({
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

      setDailyCalorieTarget: (target) =>
        set((s) => ({ goals: { ...s.goals, dailyCalorieTarget: target } })),

      resetToSeed: () => set({ ...seedData }),
    }),
    { name: "mealplan-store-v2" },
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
