import {
  recipeTotalCost, recipeCostPerServing, priceFor, quantitiesCost, BASE_STORE_ID
} from "../src/lib/cost";
import type { Recipe, Price } from "../src/lib/types";

const prices: Price[] = [
  { storeId: BASE_STORE_ID, foodId: "chicken", pricePerUnit: 0.25, updatedAt: "2026-09-01" },
  { storeId: BASE_STORE_ID, foodId: "rice", pricePerUnit: 0.50, updatedAt: "2026-09-01" },
  { storeId: "aldi", foodId: "chicken", pricePerUnit: 0.10, updatedAt: "2026-09-01" },
];

const sauce: Recipe = {
  id: "sauce", name: "Sauce", servings: 2, category: "dinner", steps: [],
  ingredients: [{ foodId: "rice", quantity: 2 }],           // $1.00 total, $0.50/serving
};
const main: Recipe = {
  id: "main", name: "Main", servings: 4, category: "dinner", steps: [],
  ingredients: [{ foodId: "chicken", quantity: 16 }],       // $4.00
  components: [{ recipeId: "sauce", servings: 2 }],         // 2 x $0.50 = $1.00
};
const unpriced: Recipe = {
  id: "un", name: "Unpriced", servings: 1, category: "dinner", steps: [],
  ingredients: [{ foodId: "chicken", quantity: 4 }, { foodId: "mystery", quantity: 1 }]
};
const cyclic: Recipe = {
  id: "cyc", name: "Cyclic", servings: 1, category: "dinner", steps: [],
  ingredients: [{ foodId: "rice", quantity: 1 }],
  components: [{ recipeId: "cyc", servings: 1 }, { recipeId: "main", servings: 1 }]
};
const all = [sauce, main, unpriced, cyclic];

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

// Sub-recipe expansion + per-serving division.
eq("main total", recipeTotalCost(main, all, prices, BASE_STORE_ID).cost, 5);
eq("main per serving (4)", recipeCostPerServing(main, all, prices, BASE_STORE_ID).cost, 1.25);
eq("sauce per serving (2)", recipeCostPerServing(sauce, all, prices, BASE_STORE_ID).cost, 0.5);

// Store price overrides base; base fills the gap.
eq("aldi override", priceFor(prices, "aldi", "chicken")?.pricePerUnit, 0.1);
eq("aldi falls back to base", priceFor(prices, "aldi", "rice")?.source, "base");
eq("main at aldi", recipeTotalCost(main, all, prices, "aldi").cost, 1 + 1.6);
eq("unknown store uses base", recipeTotalCost(main, all, prices, "nope").cost, 5);

// Missing prices are reported, never silently zeroed into a confident total.
const u = recipeTotalCost(unpriced, all, prices, BASE_STORE_ID);
eq("unpriced cost counts only priced lines", u.cost, 1);
eq("unpriced coverage", [u.priced, u.lines], [1, 2]);

// A recipe that includes itself must terminate.
eq("cycle terminates", recipeTotalCost(cyclic, all, prices, BASE_STORE_ID).cost, 0.5 + 1.25);

// Grocery-quantity costing.
const q = quantitiesCost({ chicken: 10, mystery: 3 }, prices, BASE_STORE_ID);
eq("quantities cost", [q.cost, q.priced, q.lines], [2.5, 1, 2]);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
