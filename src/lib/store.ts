"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppData,
  CalendarEvent,
  HouseholdMode,
  Member,
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
  updateFood: (foodId: string, patch: Partial<Food>) => void;
  removeFood: (foodId: string) => void;
  addRecipe: (recipe: Recipe, newFoods?: Food[]) => void;
  updateRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  addPlannedMeal: (meal: PlannedMeal) => void;
  updatePlannedMeal: (id: string, patch: Partial<PlannedMeal>) => void;
  removePlannedMeal: (id: string) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  addManualGrocery: (foodId: string, quantity: number) => void;
  removeManualGrocery: (id: string) => void;
  setGoals: (patch: Partial<AppData["goals"]>) => void;
  setProfile: (patch: Partial<AppData["profile"]>) => void;
  setHouseholdMode: (mode: HouseholdMode) => void;
  addMember: (member: Member) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  removeMember: (id: string) => void;
  setFocusAreas: (focusAreas: AppData["focusAreas"]) => void;
  /** Merge receipt-scanned items into the kitchen; returns a summary. */
  commitScan: (items: ScannedItem[]) => { merged: number; added: number; skipped: number };
  resetToSeed: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const newId = uid;

/** A new household member seeded from the primary user's goals. */
export function blankMember(name: string, goals: AppData["goals"]): Member {
  return {
    id: uid(),
    name,
    heightIn: 66,
    weightLb: 150,
    age: 30,
    goals: { ...goals },
  };
}

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

      removeFood: (foodId) =>
        set((s) => ({
          foods: s.foods.filter((f) => f.id !== foodId),
          inventory: s.inventory.filter((i) => i.foodId !== foodId),
          manualGroceries: s.manualGroceries.filter((m) => m.foodId !== foodId),
          history: s.history.filter((h) => h.foodId !== foodId),
          recipes: s.recipes.map((r) => ({ ...r, ingredients: r.ingredients.filter((ing) => ing.foodId !== foodId) })),
        })),

      addFood: (food, startQty = 0) =>
        set((s) => {
          if (s.foods.some((f) => f.id === food.id)) return s;
          return {
            foods: [...s.foods, food],
            inventory: [...s.inventory, { foodId: food.id, quantity: Math.max(0, startQty) }],
          };
        }),

      updateFood: (foodId, patch) =>
        set((s) => ({
          foods: s.foods.map((f) => (f.id === foodId ? { ...f, ...patch } : f)),
        })),

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

      updateRecipe: (recipe) =>
        set((s) => ({
          recipes: s.recipes.map((r) => (r.id === recipe.id ? recipe : r)),
        })),

      removeRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.filter((p) => p.recipeId !== id),
        })),

      addPlannedMeal: (meal) => set((s) => ({ plan: [...s.plan, meal] })),

      updatePlannedMeal: (id, patch) =>
        set((s) => ({ plan: s.plan.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removePlannedMeal: (id) =>
        set((s) => ({ plan: s.plan.filter((p) => p.id !== id) })),

      addEvent: (event) => set((s) => ({ events: [...(s.events ?? []), event] })),

      updateEvent: (id, patch) =>
        set((s) => ({ events: (s.events ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      removeEvent: (id) =>
        set((s) => ({ events: (s.events ?? []).filter((e) => e.id !== id) })),

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

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      setFocusAreas: (focusAreas) => set({ focusAreas }),

      setHouseholdMode: (mode) =>
        set((s) => {
          // Couple means exactly one other person; trim or seed to match so the
          // dashboard totals can't disagree with the chosen mode.
          if (mode === "individual") return { householdMode: mode, members: [] };
          const members = s.members ?? [];
          if (mode === "couple") {
            return {
              householdMode: mode,
              members: members.length ? [members[0]] : [blankMember("Partner", s.goals)],
            };
          }
          return { householdMode: mode, members: members.length ? members : [blankMember("Member 2", s.goals)] };
        }),

      addMember: (member) => set((s) => ({ members: [...(s.members ?? []), member] })),

      updateMember: (id, patch) =>
        set((s) => ({ members: (s.members ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      removeMember: (id) => set((s) => ({ members: (s.members ?? []).filter((m) => m.id !== id) })),

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
    {
      name: "mealplan-store-v6",
      version: 1,
      // Preserve the user's own data across app updates; only fill in missing
      // defaults and restore items that earlier resets dropped.
      migrate: (persisted) => {
        const s = persisted as Partial<AppData> | undefined;
        if (!s || !Array.isArray(s.foods)) return persisted as AppData;
        const foods = [...(s.foods as Food[])];
        const inventory = [...(s.inventory ?? [])];
        const recipes = [...(s.recipes ?? [])];
        for (const fid of ["frozenstrawberries"]) {
          if (!foods.some((f) => f.id === fid)) {
            const sf = seedData.foods.find((f) => f.id === fid);
            if (sf) { foods.push(sf); inventory.push({ foodId: sf.id, quantity: 2 }); }
          }
        }
        for (const rid of ["overnight-oats", "corn-egg-breakfast"]) {
          if (!recipes.some((r) => r.id === rid)) {
            const sr = seedData.recipes.find((r) => r.id === rid);
            if (sr) recipes.push(sr);
          }
        }
        return {
          ...seedData,
          ...s,
          foods,
          inventory,
          recipes,
          events: s.events ?? [],
          history: s.history ?? [],
          manualGroceries: s.manualGroceries ?? [],
          goals: { ...seedData.goals, ...(s.goals ?? {}) },
          profile: { ...seedData.profile, ...(s.profile ?? {}) },
          focusAreas: s.focusAreas ?? seedData.focusAreas,
          householdMode: s.householdMode ?? "individual",
          members: s.members ?? [],
        } as AppData;
      },
    },
  ),
);

// ---- Household helpers ----

/** Everyone the plan feeds: the primary user first, then any added members. */
export interface Eater { id: string; name: string; goals: AppData["goals"] }

export function household(s: Pick<AppData, "goals" | "profile" | "members">): Eater[] {
  return [
    { id: "me", name: "You", goals: s.goals },
    ...(s.members ?? []).map((m) => ({ id: m.id, name: m.name, goals: m.goals })),
  ];
}

/** Summed daily targets for a set of eaters — the household's goal line. */
export function combinedGoals(eaters: Eater[]): AppData["goals"] {
  return eaters.reduce(
    (acc, e) => ({
      dailyCalorieTarget: acc.dailyCalorieTarget + e.goals.dailyCalorieTarget,
      proteinTarget: acc.proteinTarget + e.goals.proteinTarget,
      carbsTarget: acc.carbsTarget + e.goals.carbsTarget,
      fatTarget: acc.fatTarget + e.goals.fatTarget,
    }),
    { dailyCalorieTarget: 0, proteinTarget: 0, carbsTarget: 0, fatTarget: 0 },
  );
}

// ---- Cloud sync helpers ----

/** The persisted data slice, without the action functions. */
export function exportData(s: AppState = useApp.getState()): AppData {
  return {
    foods: s.foods,
    inventory: s.inventory,
    recipes: s.recipes,
    plan: s.plan,
    events: s.events ?? [],
    manualGroceries: s.manualGroceries,
    goals: s.goals,
    profile: s.profile,
    focusAreas: s.focusAreas ?? [],
    householdMode: s.householdMode ?? "individual",
    members: s.members ?? [],
    history: s.history,
  };
}

/** Replace local data wholesale (used when pulling from the cloud). */
export function importData(data: Partial<AppData>) {
  useApp.setState({
    ...seedData,
    ...data,
    events: data.events ?? [],
    focusAreas: data.focusAreas ?? seedData.focusAreas,
    householdMode: data.householdMode ?? "individual",
    members: data.members ?? [],
    goals: { ...seedData.goals, ...(data.goals ?? {}) },
    profile: { ...seedData.profile, ...(data.profile ?? {}) },
  });
}

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

/** Raw (unrounded) macro+calorie totals for the WHOLE recipe (all servings),
 *  expanding any sub-recipe components. `seen` guards against cycles. */
function grossTotals(
  recipe: Recipe,
  foods: Food[],
  recipes: Recipe[],
  seen: Set<string>,
): Totals {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const ing of recipe.ingredients) {
    const food = foodById(foods, ing.foodId);
    if (!food) continue;
    acc.calories += food.caloriesPerUnit * ing.quantity;
    acc.protein += food.protein * ing.quantity;
    acc.carbs += food.carbs * ing.quantity;
    acc.fat += food.fat * ing.quantity;
  }
  for (const comp of recipe.components ?? []) {
    if (seen.has(comp.recipeId) || comp.recipeId === recipe.id) continue;
    const sub = recipes.find((r) => r.id === comp.recipeId);
    if (!sub) continue;
    const per = perServingRaw(sub, foods, recipes, new Set(seen).add(recipe.id));
    acc.calories += per.calories * comp.servings;
    acc.protein += per.protein * comp.servings;
    acc.carbs += per.carbs * comp.servings;
    acc.fat += per.fat * comp.servings;
  }
  return acc;
}

function perServingRaw(recipe: Recipe, foods: Food[], recipes: Recipe[], seen: Set<string>): Totals {
  const g = grossTotals(recipe, foods, recipes, seen);
  const s = recipe.servings || 1;
  return { calories: g.calories / s, protein: g.protein / s, carbs: g.carbs / s, fat: g.fat / s };
}

/** Total calories for the whole recipe (all servings), including sub-recipes. */
export function recipeTotalCalories(recipe: Recipe, foods: Food[], recipes: Recipe[] = []): number {
  return Math.round(grossTotals(recipe, foods, recipes, new Set()).calories);
}

/** Calories for one serving of a recipe, including sub-recipes. */
export function recipeCaloriesPerServing(recipe: Recipe, foods: Food[], recipes: Recipe[] = []): number {
  return Math.round(perServingRaw(recipe, foods, recipes, new Set()).calories);
}

/** Full macro + calorie totals for one serving of a recipe, including sub-recipes. */
export function recipeTotalsPerServing(recipe: Recipe, foods: Food[], recipes: Recipe[] = []): Totals {
  const p = perServingRaw(recipe, foods, recipes, new Set());
  return {
    calories: Math.round(p.calories),
    protein: Math.round(p.protein),
    carbs: Math.round(p.carbs),
    fat: Math.round(p.fat),
  };
}

/** Calories contributed by one sub-recipe component (per-serving × servings). */
export function componentCalories(
  comp: { recipeId: string; servings: number },
  foods: Food[],
  recipes: Recipe[],
): number {
  const sub = recipes.find((r) => r.id === comp.recipeId);
  if (!sub) return 0;
  return Math.round(recipeCaloriesPerServing(sub, foods, recipes) * comp.servings);
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
    const per = recipeTotalsPerServing(recipe, foods, recipes);
    acc.calories += per.calories * meal.servings;
    acc.protein += per.protein * meal.servings;
    acc.carbs += per.carbs * meal.servings;
    acc.fat += per.fat * meal.servings;
  }
  return acc;
}

/** Total quantity of each food required by a set of planned meals — sub-recipe
 *  components are expanded down to their underlying foods. */
export function neededQuantities(
  meals: PlannedMeal[],
  recipes: Recipe[],
): Record<string, number> {
  const need: Record<string, number> = {};
  const addRecipe = (recipe: Recipe, factor: number, seen: Set<string>) => {
    for (const ing of recipe.ingredients) {
      need[ing.foodId] = (need[ing.foodId] ?? 0) + ing.quantity * factor;
    }
    for (const comp of recipe.components ?? []) {
      if (seen.has(comp.recipeId) || comp.recipeId === recipe.id) continue;
      const sub = recipes.find((r) => r.id === comp.recipeId);
      if (!sub) continue;
      const subFactor = (comp.servings * factor) / (sub.servings || 1);
      addRecipe(sub, subFactor, new Set(seen).add(recipe.id));
    }
  };
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    if (!recipe) continue;
    addRecipe(recipe, meal.servings / (recipe.servings || 1), new Set());
  }
  return need;
}
