// foodtable.ts is the "text converter" behind pasting a recipe/food table —
// and its comma-delimited path now shares csv.ts's parser instead of its own
// single-line splitter. This checks that swap didn't regress anything, plus
// a round trip through recipescan.ts's new CSV export.

import { parseFoodTable } from "../src/lib/foodtable";
import { recipeIngredientsToCsv, type ScannedRecipe } from "../src/lib/recipescan";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) { failures++; console.log(`FAIL ${name}${detail !== undefined ? `\n  ${JSON.stringify(detail)}` : ""}`); }
  else console.log(`ok   ${name}`);
}

// 1. Tab-delimited table (the common spreadsheet paste) still works.
{
  const t = parseFoodTable("Food\tQuantity\tUnit\tCalories per Unit\nChicken\t16\toz\t50");
  check("tab table", t?.rows.length === 1 && t.rows[0].food === "Chicken" && t.rows[0].caloriesPerUnit === 50, t);
}

// 2. Comma-delimited with a quoted cell containing a comma (the case the
// csv.ts swap needed to keep working).
{
  const t = parseFoodTable('Food,Quantity,Unit\n"Ground Beef, 80/20",16,oz');
  check("comma table with quoted comma", t?.rows[0]?.food === "Ground Beef, 80/20", t);
}

// 3. Markdown pipe table.
{
  const t = parseFoodTable("| Food | Quantity | Unit |\n|---|---|---|\n| Rice | 2 | cup |");
  check("pipe table", t?.rows[0]?.food === "Rice" && t.rows[0].quantity === 2, t);
}

// 4. TOTAL / PER SERVING summary rows are absorbed, not emitted as ingredients.
{
  const t = parseFoodTable(
    "Food\tQuantity\tUnit\tTotal Calories\nPasta\t8\toz\t800\nTOTAL\t\t\t800\nPER SERVING (4 servings)\t\t\t200",
  );
  check("summary rows absorbed", t?.rows.length === 1, t?.rows);
  check("servings read from summary", t?.servings === 4, t?.servings);
  check("declared totals read", t?.declaredTotalCalories === 800 && t?.declaredPerServingCalories === 200, t);
}

// 5. Prose (not a table) correctly returns null so callers fall back to
// line-by-line parsing — the comma swap must not make prose look tabular.
{
  const t = parseFoodTable("2 eggs, beaten\n1 cup flour, sifted\nsalt, to taste");
  check("prose is not mistaken for a table", t === null, t);
}

// 6. A recipe exported to CSV by recipescan.ts, pasted back in, parses to
// the same ingredients — the export/import round trip the review screen's
// "Export CSV" button promises.
{
  const recipe: Pick<ScannedRecipe, "ingredients"> = {
    ingredients: [
      { food: "Ground Beef, 80/20", quantity: 16, unit: "oz", category: "Protein", caloriesPerUnit: 70, protein: 5, carbs: 0, fat: 6 },
      { food: 'Marinara Sauce "Family Size"', quantity: 2, unit: "cup", category: "Pantry", caloriesPerUnit: 80 },
      { food: "Farfalle Pasta", quantity: 8, unit: "cup", category: "Pantry", caloriesPerUnit: 200, note: "dry" },
    ],
  };
  const csv = recipeIngredientsToCsv(recipe);
  const table = parseFoodTable(csv);
  check("recipe csv -> table: row count", table?.rows.length === 3, table?.rows);
  check(
    "recipe csv -> table: names preserved",
    table?.rows.map((r) => r.food).join("|") === recipe.ingredients.map((i) => i.food).join("|"),
    table?.rows.map((r) => r.food),
  );
  check(
    "recipe csv -> table: calories preserved",
    table?.rows[0]?.caloriesPerUnit === 70 && table.rows[1]?.caloriesPerUnit === 80,
    table?.rows,
  );
}

// 7. A large pasted table (hundreds of ingredient rows) parses without
// pathological slowdown.
{
  const lines = ["Food,Quantity,Unit,Calories per Unit"];
  for (let i = 0; i < 2000; i++) lines.push(`Ingredient ${i},${i % 9 || 1},oz,${(i % 300) + 10}`);
  const start = Date.now();
  const t = parseFoodTable(lines.join("\n"));
  const ms = Date.now() - start;
  check("large table row count", t?.rows.length === 2000, t?.rows.length);
  check("large table parse time", ms < 3000, `${ms}ms`);
}

// 8. Ill-formed rows (missing unit, non-numeric quantity) don't crash the
// parser — they just come through with best-effort defaults.
{
  const t = parseFoodTable("Food,Quantity,Unit\nMystery Item,not-a-number,\nAnother,,cup");
  check("malformed rows don't throw", t !== undefined);
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll foodtable stress checks passed.");
process.exit(failures ? 1 : 0);
