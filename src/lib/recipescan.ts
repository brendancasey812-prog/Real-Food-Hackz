import { askClaude, parseJsonLoose, ReceiptError, SERVER_AI, type ImagePart } from "./aiclient";
import { stringifyCsv } from "./csv";
import { parseFoodTable, parseQuantity, parseUnitCell, type FoodTable } from "./foodtable";
import { MEAL_LABEL } from "./week";
import type { MealType, Unit } from "./types";

export { SERVER_AI };

export interface ScannedRecipeIngredient {
  food: string;
  quantity: number;
  unit: Unit;
  category: "Protein" | "Fruit" | "Veggie" | "Pantry";
  /** Calories in one `unit`, when the source listed them. */
  caloriesPerUnit?: number;
  /** Grams per one `unit`, when the source listed them. */
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Prep/state detail kept out of the name ("dry", "chopped", "80/20"). */
  note?: string;
}
export interface ScannedRecipe {
  name: string;
  servings: number;
  meal: MealType;
  ingredients: ScannedRecipeIngredient[];
  steps: string[];
  /** Totals the source itself stated — shown next to our math as a cross-check. */
  declaredTotalCalories?: number;
  declaredPerServingCalories?: number;
}

/** The JSON both the photo and the text scanners must return. */
const SCHEMA = `{
  "name": "string",
  "servings": number,
  "meal": "breakfast | lunch | snack | dinner",
  "ingredients": [
    {
      "food": "string",
      "quantity": number,
      "unit": "each | cup | tbsp | tsp | oz",
      "category": "Protein | Fruit | Veggie | Pantry",
      "caloriesPerUnit": number (calories in ONE of the unit above; omit if unknown),
      "protein": number, "carbs": number, "fat": number (grams per ONE unit; omit if unknown),
      "note": "string (prep/state/brand detail, e.g. \"dry\", \"chopped\", \"80/20\"; omit if none)"
    }
  ],
  "steps": ["string"],
  "declaredTotalCalories": number (only if the source states a total; omit otherwise),
  "declaredPerServingCalories": number (only if the source states one; omit otherwise)
}`;

/** Rules that apply whether the source is a photo or pasted text. */
const SHARED_RULES = `UNITS: convert every quantity into exactly one US unit from this set: each, cup, tbsp, tsp, oz. Convert other units yourself (1 lb = 16 oz, 1 g = 0.035 oz, 1 pint = 2 cups, 1 clove/slice/can = 1 each). A unit written with a state qualifier ("cups dry", "cup chopped", "tsp minced", "oz cooked") uses the base unit — put the qualifier in "note", never in "unit".

NAMES: keep the specific product, brand and variety in "food" (e.g. "Farfalle Pasta De Cecco", "Ground Beef 80/20", "Marinara Sauce Kirkland Organic Tuscany") — these identify the exact item and its calories. Strip only prep verbs ("chopped", "diced", "to taste", "for garnish") into "note". If a quantity is missing, set quantity to 0 and the app will ask the user for it.

TABLES: the source may be a table (columns separated by tabs, commas, pipes, or spacing) with a header row such as: Food | Quantity | Unit | Serving Size Number | Serving Size Unit | Calories per Unit | Total Calories. Map every data row to one ingredient, reading each column by its header rather than by position.

CALORIE MATH: a "Calories per Unit" (or "Calories per Serving") column is calories for ONE SERVING SIZE, which is "Serving Size Number" x "Serving Size Unit" — not for one of your output units. Rescale it: caloriesPerUnit = column value / (serving size number, converted into your output unit). Examples: 40 cal per 0.5 cup -> 80 per cup; 280 cal per 4 oz -> 70 per oz; 200 cal per 1 cup dry -> 200 per cup. When a "Total Calories" column exists, cross-check with total / quantity and prefer the value the two agree on. Never copy a per-serving number straight into caloriesPerUnit.

SUMMARY ROWS: rows like "TOTAL", "SUBTOTAL", "PER SERVING (6 servings)" are not ingredients — never emit them. Use them instead: read the stated totals into declaredTotalCalories / declaredPerServingCalories, and take the servings count from text like "PER SERVING (6 servings)" or "Serves 4". If no servings count is stated anywhere, and total and per-serving calories both are, divide them to get it.

CATEGORY: classify each ingredient as Protein, Fruit, Veggie, or Pantry (dairy, grains, pasta, sauces, oils, spices, other packaged goods = Pantry). Pick the single best meal for the dish: breakfast, lunch, snack, or dinner.`;

export const RECIPE_SYSTEM_PROMPT = `You are a recipe-scanning assistant for a meal-planning app. You will be given a photo of a recipe or food list — a recipe card, a cookbook page, a handwritten note, a spreadsheet, or a screenshot of a nutrition table. Extract it into JSON.

${SHARED_RULES}

Return only this JSON — no other text:

${SCHEMA}`;

const TEXT_SYSTEM_PROMPT = `You are a recipe assistant for a meal-planning app. You will be given pasted text: an ingredient list, a full recipe, or a table of foods with quantities and calories copied out of a spreadsheet or document. Turn it into a structured recipe JSON.

${SHARED_RULES}

SERVINGS: use the servings the text states. Only if it states none, default to 1 (a meal for one average person).

Return only this JSON — no other text:

${SCHEMA}`;

const UNITS = ["each", "cup", "tbsp", "tsp", "oz"];
const MEALS = ["breakfast", "lunch", "snack", "dinner", "extra"];
const CATS = ["Protein", "Fruit", "Veggie", "Pantry"];

/** A positive number, or undefined — for optional nutrition fields. */
function optNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Coerce whatever the model wrote for a unit into one of ours. It usually
 * follows the schema, but "cups dry" / "lb" / "grams" come back often enough
 * that dropping those ingredients (the old behavior) lost real data.
 */
function coerceUnit(raw: unknown, quantity: number): { unit: Unit; quantity: number; note?: string } {
  const s = String(raw ?? "").trim();
  if (UNITS.includes(s)) return { unit: s as Unit, quantity };
  const parsed = parseUnitCell(s);
  if (parsed) return { unit: parsed.unit, quantity: quantity * parsed.factor, note: parsed.modifier };
  return { unit: "each", quantity };
}

function parseRecipe(text: string): ScannedRecipe {
  const data = parseJsonLoose(text, "The recipe couldn't be read. Try a clearer, straight-on photo.");
  const o = data as Partial<ScannedRecipe>;
  const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : [])
    .filter((i) => i && i.food)
    .map((i) => {
      const u = coerceUnit(i.unit, Math.max(0, Number(i.quantity) || 0));
      const note = [i.note ? String(i.note).trim() : "", u.note ?? ""].filter(Boolean).join(", ");
      return {
        food: String(i.food).trim(),
        quantity: Math.round(u.quantity * 100) / 100, // 0 = unknown; user fills it in
        unit: u.unit,
        category: (CATS.includes(i.category) ? i.category : "Pantry") as ScannedRecipeIngredient["category"],
        caloriesPerUnit: optNum(i.caloriesPerUnit),
        protein: optNum(i.protein),
        carbs: optNum(i.carbs),
        fat: optNum(i.fat),
        note: note || undefined
      };
    });
  if (!o.name || ingredients.length === 0) {
    throw new ReceiptError("No recipe was found. Make sure the recipe title and ingredients are in frame, then try again.");
  }
  return {
    name: String(o.name).trim(),
    servings: Number(o.servings) > 0 ? Number(o.servings) : 2,
    meal: (MEALS.includes(o.meal as string) ? o.meal : "dinner") as MealType,
    ingredients,
    steps: Array.isArray(o.steps) ? o.steps.map((s) => String(s).trim()).filter(Boolean) : [],
    declaredTotalCalories: optNum(o.declaredTotalCalories),
    declaredPerServingCalories: optNum(o.declaredPerServingCalories)
  };
}

export async function scanRecipe(
  apiKey: string,
  base64: string,
  mediaType: ImagePart["media_type"],
): Promise<ScannedRecipe> {
  const text = await askClaude(
    apiKey,
    RECIPE_SYSTEM_PROMPT,
    "Extract this recipe as JSON.",
    { media_type: mediaType, data: base64 },
    "Add your Anthropic API key in Settings to scan a photo.",
  );
  return parseRecipe(text);
}

/** Build a recipe from pasted text via Claude. */
export async function buildRecipeFromText(apiKey: string, text: string): Promise<ScannedRecipe> {
  const prompt = `Here is the recipe text:\n\n${text}\n\nBuild it into a recipe as JSON.`;
  const out = await askClaude(apiKey, TEXT_SYSTEM_PROMPT, prompt, undefined, "Add your Anthropic API key in Settings to use AI parsing.");
  return parseRecipe(out);
}

// ---- Build a new recipe from a food request (no source to read) ----

const GENERATE_RULES = `UNITS: every ingredient quantity uses exactly one US unit from this set: each, cup, tbsp, tsp, oz.

NAMES: use plain grocery-shelf names in "food" (e.g. "Chicken breast", "Brown rice", "Broccoli") — no brand names, since nothing has been bought yet.

CALORIES: every ingredient must carry caloriesPerUnit and protein/carbs/fat per unit — these are being invented for a new recipe rather than read off a label, so give your best real-world estimate for that food and unit instead of omitting them.

CATEGORY: classify each ingredient as Protein, Fruit, Veggie, or Pantry (dairy, grains, starches, sauces, oils, spices = Pantry).

BALANCE: unless the request itself names a single-food dish (a smoothie, a salad, a soup), build a real plate — a protein, a carb or starch, and at least one vegetable or fruit — not just the named ingredient on its own.`;

const GENERATE_SYSTEM_PROMPT = `You are a recipe-creation assistant for a meal-planning app. A user names a protein or type of food, a meal, and a per-serving calorie/macro target; invent one complete, realistic recipe that fits.

${GENERATE_RULES}

TARGET: aim the recipe's total calories and macros for one serving within about 10% of the target given. Set "servings" to what was asked for.

Return only this JSON — no other text:

${SCHEMA}`;

export interface RecipeAsk {
  /** What the user typed — a protein, dish, or type of food. */
  request: string;
  meal: MealType;
  servings: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
}

/** Invent a recipe from scratch — no photo or text to read, just a request and targets. */
export async function generateRecipe(apiKey: string, ask: RecipeAsk): Promise<ScannedRecipe> {
  const prompt = `Build a ${MEAL_LABEL[ask.meal] ?? ask.meal} recipe built around: ${ask.request.trim()}.
Servings: ${Math.max(1, Math.round(ask.servings))}.
Target per serving: about ${Math.round(ask.targetCalories)} calories, ${Math.round(ask.targetProtein)}g protein, ${Math.round(ask.targetCarbs)}g carbs, ${Math.round(ask.targetFat)}g fat.

Return the recipe as JSON.`;

  const out = await askClaude(apiKey, GENERATE_SYSTEM_PROMPT, prompt, undefined, "Add your Anthropic API key in Settings to build a recipe with AI.");
  return parseRecipe(out);
}

// ---- No-key local text parser (best effort) ----

const CAT_WORDS: { re: RegExp; cat: ScannedRecipeIngredient["category"] }[] = [
  // Pantry staples first: "black pepper" and "bell pepper" would otherwise
  // both land in Veggie, and pasta/sauces read as neither protein nor produce.
  { re: /\b(salt|black pepper|peppercorn|spice|seasoning|sugar|flour|pasta|spaghetti|penne|farfalle|macaroni|noodle|rice|quinoa|oat|bread|tortilla|cracker|cereal|oil|vinegar|sauce|marinara|salsa|ketchup|mustard|mayo|broth|stock|syrup|honey|powder|extract|bean|lentil|chickpea)\b/i, cat: "Pantry" },
  { re: /chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|egg|tofu|bacon|sausage|steak|ham|yogurt|cheese|milk/i, cat: "Protein" },
  { re: /apple|banana|berr|straw|blueberr|orange|grape|pineapple|mango|peach|lemon|lime|fruit/i, cat: "Fruit" },
  { re: /lettuce|spinach|arugula|kale|broccoli|carrot|onion|pepper|garlic|tomato|cucumber|zucchini|mushroom|celery|greens|veg/i, cat: "Veggie" },
];
// Descriptor / prep words stripped from ingredient names.
const FILLER = new Set([
  "fresh", "freshly", "chopped", "diced", "minced", "sliced", "shredded", "grated", "crushed",
  "ripe", "large", "small", "medium", "boneless", "skinless", "peeled", "seeded", "deseeded",
  "drained", "rinsed", "halved", "quartered", "cubed", "packed", "softened", "melted", "divided",
  "roughly", "finely", "thinly", "cold", "warm", "hot", "room", "temperature", "cooked", "raw",
  "of", "a", "an", "the", "some", "and", "plus", "more", "about", "approximately", "approx",
  "whole", "dried", "toasted", "beaten", "cored", "trimmed", "extra", "virgin", "low", "fat",
  "reduced", "unsalted", "salted", "granulated", "pure",
]);

function guessCat(name: string): ScannedRecipeIngredient["category"] {
  for (const { re, cat } of CAT_WORDS) if (re.test(name)) return cat;
  return "Pantry";
}
function cleanName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parentheticals
    .split(/[^a-z0-9/%-]+/) // keep "80/20", "2%"
    .filter((t) => t && !FILLER.has(t));
  const name = tokens.join(" ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

/** Trailing calorie note on a prose line: "1 cup oats (150 cal)", "2 eggs - 140 calories". */
function pullCalories(line: string): { line: string; calories?: number } {
  const m = line.match(/[([\u2013\u2014,-]\s*(\d[\d.,]*)\s*(?:k?cal|calories|kcals?)\b\s*[)\]]?\s*$/i);
  if (!m) return { line };
  return { line: line.slice(0, m.index).trim(), calories: Number(m[1].replace(/,/g, "")) };
}

/** Turn a parsed food table into a recipe. */
function recipeFromTable(table: FoodTable): ScannedRecipe {
  const ingredients: ScannedRecipeIngredient[] = table.rows.map((r) => ({
    food: r.food,
    quantity: r.quantity,
    unit: r.unit,
    category: guessCat(r.food),
    caloriesPerUnit: r.caloriesPerUnit,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    note: r.note
  }));
  return {
    name: table.title ?? "Pasted food list",
    servings: table.servings && table.servings > 0 ? table.servings : 1,
    meal: "dinner",
    ingredients,
    steps: [],
    declaredTotalCalories: table.declaredTotalCalories,
    declaredPerServingCalories: table.declaredPerServingCalories
  };
}

/** Best-effort local parse (used when no API key is set). */
export function parseTextLocally(text: string): ScannedRecipe {
  // Spreadsheet-style pastes (tab / pipe / comma / column-aligned) carry
  // quantities, units and calories in columns — read those first.
  const table = parseFoodTable(text);
  if (table) return recipeFromTable(table);

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // A short first line with no quantity is likely the title.
  let name = "Pasted recipe";
  let body = lines;
  if (lines.length > 1 && !/\d/.test(lines[0]) && lines[0].split(" ").length <= 6) {
    name = lines[0];
    body = lines.slice(1);
  }

  let servings: number | undefined;
  const ingredients: ScannedRecipeIngredient[] = body
    .map((raw): ScannedRecipeIngredient | null => {
      const serves = raw.match(/\b(?:serves|servings?|yields?|makes)\b\D{0,4}(\d+(?:\.\d+)?)/i);
      if (serves && !/^\d/.test(raw.trim())) { servings = servings ?? Number(serves[1]); return null; }

      const pulled = pullCalories(raw);
      let s = pulled.line
        .replace(/^[-*\u2022]\s*/, "")
        .replace(/\b(to taste|for garnish|for serving|as needed|optional|if desired|divided)\b.*$/gi, " ")
        .split(",")[0]
        .trim();
      if (!s) return null;

      let quantity = 0;
      let unit: Unit = "each";
      let note: string | undefined;
      // Leading quantity, then an optional unit word + qualifier. The quantity
      // alternatives are ordered longest-first so "1 1/2" and "1/2" beat "1".
      const m = s.match(
        /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d[\d.,]*\s*[\u00bd\u2153\u2154\u00bc\u00be\u2155-\u215e]?|[\u00bd\u2153\u2154\u00bc\u00be\u2155-\u215e])\s*([a-zA-Z.]+)?\s*(.*)$/,
      );
      if (m && m[1] && parseQuantity(m[1]) !== null) {
        quantity = parseQuantity(m[1]) ?? 0;
        const parsed = parseUnitCell(m[2] ?? "");
        if (parsed) {
          unit = parsed.unit;
          quantity *= parsed.factor;
          note = parsed.modifier;
          s = m[3] || "";
        } else s = ((m[2] ? m[2] + " " : "") + (m[3] || "")).trim();
      }
      const food = cleanName(s) || cleanName(raw);
      if (!food) return null;
      const quantized = Math.round(quantity * 100) / 100;
      return {
        food,
        quantity: quantized,
        unit,
        category: guessCat(food),
        caloriesPerUnit:
          pulled.calories !== undefined && quantized > 0
            ? Math.round((pulled.calories / quantized) * 100) / 100
            : undefined,
        note
      };
    })
    .filter((i): i is ScannedRecipeIngredient => i !== null);

  return { name, servings: servings && servings > 0 ? servings : 1, meal: "dinner", ingredients, steps: [] };
}

// ---- CSV export (works with no API key at all) ----

const RECIPE_CSV_HEADER = ["Food", "Quantity", "Unit", "Category", "Calories per Unit", "Protein", "Carbs", "Fat", "Note"];

/**
 * A recipe's ingredients as CSV, ready for `download()`. Uses the same column
 * names `parseFoodTable` already reads (Food / Quantity / Unit / Calories per
 * Unit / Protein / Carbs / Fat), so pasting this file's contents back into
 * "Paste a recipe" reconstructs the same ingredient list — a scan is never a
 * dead end even when the on-screen review table isn't the right editor for it.
 */
export function recipeIngredientsToCsv(recipe: Pick<ScannedRecipe, "ingredients">): string {
  const rows: string[][] = [RECIPE_CSV_HEADER];
  for (const ing of recipe.ingredients) {
    rows.push([
      ing.food,
      String(ing.quantity),
      ing.unit,
      ing.category,
      ing.caloriesPerUnit != null ? String(ing.caloriesPerUnit) : "",
      ing.protein != null ? String(ing.protein) : "",
      ing.carbs != null ? String(ing.carbs) : "",
      ing.fat != null ? String(ing.fat) : "",
      ing.note ?? "",
    ]);
  }
  return stringifyCsv(rows);
}

export function demoScanRecipe(): Promise<ScannedRecipe> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          name: "Tofu & Veggie Rice Bowl",
          servings: 2,
          meal: "dinner",
          ingredients: [
            { food: "Tofu (firm)", quantity: 10, unit: "oz", category: "Protein" },
            { food: "Jasmine rice", quantity: 6, unit: "oz", category: "Pantry" },
            { food: "Arugula", quantity: 2, unit: "cup", category: "Veggie" },
            { food: "Garlic", quantity: 2, unit: "each", category: "Veggie" },
            { food: "Yangnyeom sauce", quantity: 3, unit: "tbsp", category: "Pantry" },
            { food: "Sesame oil", quantity: 1, unit: "tbsp", category: "Pantry" },
          ],
          steps: [
            "Cook the jasmine rice.",
            "Pan-fry cubed tofu in sesame oil until golden.",
            "Add minced garlic and Yangnyeom sauce; toss to coat.",
            "Serve over rice with fresh arugula.",
          ]
        }),
      1100,
    ),
  );
}
