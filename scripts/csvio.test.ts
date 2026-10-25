// Round-trip checks for the foods and prices CSV round trips wired into the
// Kitchen/Groceries/Costs tabs — export → import should reconstruct the same
// data, and a hand-edited file with an unknown food should be reported, not
// silently dropped or used to invent a new one where that would be wrong.

import { foodsToCsv, csvToFoods, matchExistingFood } from "../src/lib/foodsio";
import { pricesToCsv, csvToPrices } from "../src/lib/pricesio";
import type { Food, InventoryItem } from "../src/lib/types";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) { failures++; console.log(`FAIL ${name}${detail !== undefined ? `\n  ${JSON.stringify(detail)}` : ""}`); }
  else console.log(`ok   ${name}`);
}

const foods: Food[] = [
  { id: "chicken", name: "Chicken breast", unit: "oz", caloriesPerUnit: 47, protein: 8.7, carbs: 0, fat: 1, location: "fridge", category: "protein" },
  { id: "rice", name: "Brown rice", unit: "cup", caloriesPerUnit: 216, protein: 5, carbs: 45, fat: 1.8, location: "pantry", category: "grain" },
  { id: "sauce", name: 'Marinara, "Family" size', unit: "cup", caloriesPerUnit: 80, protein: 2, carbs: 12, fat: 2, location: "pantry", category: "condiment", notes: "opened" },
];
const inventory: InventoryItem[] = [
  { foodId: "chicken", quantity: 24 },
  { foodId: "rice", quantity: 3 },
  { foodId: "sauce", quantity: 0 },
];

// 1. Foods catalog round trip: export then import reads back the same values.
{
  const csv = foodsToCsv(foods, inventory);
  const { items, errors } = csvToFoods(csv);
  check("foods csv: row count", items.length === foods.length, items.length);
  check("foods csv: no errors", errors.length === 0, errors);
  const byName = Object.fromEntries(items.map((i) => [i.name, i]));
  check("foods csv: quantity preserved", byName["Chicken breast"]?.quantity === 24, byName["Chicken breast"]);
  check("foods csv: quoted comma name preserved", byName['Marinara, "Family" size']?.caloriesPerUnit === 80);
  check("foods csv: notes preserved", byName['Marinara, "Family" size']?.notes === "opened");
}

// 2. matchExistingFood is case/whitespace tolerant, same as the receipt merge.
check("matchExistingFood: case tolerant", matchExistingFood(foods, "  CHICKEN breast ")?.id === "chicken");
check("matchExistingFood: no match", matchExistingFood(foods, "Tofu") === undefined);

// 3. A malformed foods CSV (bad category, missing unit) still imports with
// sane defaults rather than throwing.
{
  const csv = "Name,Category,Location,Unit,Quantity\nMystery Snack,not-a-category,not-a-place,not-a-unit,5";
  const { items, errors } = csvToFoods(csv);
  check("foods csv: unknown category defaults", items[0]?.category === "condiment", items[0]);
  check("foods csv: unknown location defaults", items[0]?.location === "pantry", items[0]);
  check("foods csv: unknown unit defaults", items[0]?.unit === "each", items[0]);
  check("foods csv: no errors on defaulted row", errors.length === 0);
}

// 4. Prices round trip for one store: export, then import the same file back.
{
  const priceFor = (id: string) => (id === "chicken" ? 0.45 : id === "rice" ? 0.12 : null);
  const csv = pricesToCsv(foods, priceFor);
  const { items, errors } = csvToPrices(csv, foods);
  check("prices csv: only priced rows import", items.length === 2, items.map((i) => i.food.name));
  check("prices csv: no errors", errors.length === 0, errors);
  check(
    "prices csv: value preserved",
    items.find((i) => i.food.id === "chicken")?.pricePerUnit === 0.45,
  );
}

// 5. A prices CSV naming a food that isn't in the kitchen is reported, not
// silently used to invent one.
{
  const csv = "Food,Unit,Price (USD)\nTofu,oz,0.30\nChicken breast,oz,0.50";
  const { items, errors } = csvToPrices(csv, foods);
  check("prices csv: unknown food rejected", items.length === 1 && items[0].food.id === "chicken", { items, errors });
  check("prices csv: unknown food reported", errors.length === 1 && errors[0].row === 2, errors);
}

// 6. A blank price cell is skipped quietly — not an error.
{
  const csv = "Food,Unit,Price (USD)\nChicken breast,oz,\nBrown rice,cup,0.20";
  const { items, errors } = csvToPrices(csv, foods);
  check("prices csv: blank price skipped quietly", items.length === 1 && errors.length === 0, { items, errors });
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll csvio checks passed.");
process.exit(failures ? 1 : 0);
