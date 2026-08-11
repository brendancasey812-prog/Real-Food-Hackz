import Anthropic from "@anthropic-ai/sdk";
import { ReceiptError } from "./receipt";
import type { MealType, Unit } from "./types";

const MODEL = "claude-opus-5";

export interface ScannedRecipeIngredient {
  food: string;
  quantity: number;
  unit: Unit;
  category: "Protein" | "Fruit" | "Veggie" | "Pantry";
}
export interface ScannedRecipe {
  name: string;
  emoji: string;
  servings: number;
  meal: MealType;
  ingredients: ScannedRecipeIngredient[];
  steps: string[];
}

export const RECIPE_SYSTEM_PROMPT = `You are a recipe-scanning assistant for a meal-planning app. You will be given a photo of a recipe (a card, cookbook page, or handwritten note). Extract the recipe into JSON. Use general, human-readable ingredient names. Convert each ingredient quantity into one US unit from this set only: each, cup, tbsp, tsp, oz. If a quantity is not given for an ingredient, set its quantity to 0 (the app will ask the user to fill it in). Strip filler and prep words from the food name (e.g. "chopped", "fresh", "to taste", "for garnish", "optional", "diced") — keep just the ingredient itself. Classify each ingredient into Protein, Fruit, Veggie, or Pantry (dairy/grains/sauces/oils/other packaged = Pantry). Choose the single best meal for the recipe: breakfast, lunch, snack, or dinner. Pick one food emoji that represents the dish. Return only the JSON below — no other text.

{
  "name": "string",
  "emoji": "string (one emoji)",
  "servings": number,
  "meal": "breakfast | lunch | snack | dinner",
  "ingredients": [ { "food": "string", "quantity": number, "unit": "each | cup | tbsp | tsp | oz", "category": "Protein | Fruit | Veggie | Pantry" } ],
  "steps": ["string"]
}`;

const UNITS = ["each", "cup", "tbsp", "tsp", "oz"];
const MEALS = ["breakfast", "lunch", "snack", "dinner", "extra"];
const CATS = ["Protein", "Fruit", "Veggie", "Pantry"];

function parseRecipe(text: string): ScannedRecipe {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new ReceiptError("The recipe couldn't be read. Try a clearer, straight-on photo.");
    data = JSON.parse(m[0]);
  }
  const o = data as Partial<ScannedRecipe>;
  const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : [])
    .filter((i) => i && i.food && UNITS.includes(i.unit) && CATS.includes(i.category))
    .map((i) => ({
      food: String(i.food).trim(),
      quantity: Math.max(0, Number(i.quantity) || 0), // 0 = unknown; user fills it in
      unit: i.unit,
      category: i.category,
    }));
  if (!o.name || ingredients.length === 0) {
    throw new ReceiptError("No recipe was found. Make sure the recipe title and ingredients are in frame, then try again.");
  }
  return {
    name: String(o.name).trim(),
    emoji: o.emoji && String(o.emoji).trim() ? String(o.emoji).trim() : "🍽️",
    servings: Number(o.servings) > 0 ? Number(o.servings) : 2,
    meal: (MEALS.includes(o.meal as string) ? o.meal : "dinner") as MealType,
    ingredients,
    steps: Array.isArray(o.steps) ? o.steps.map((s) => String(s).trim()).filter(Boolean) : [],
  };
}

export async function scanRecipe(
  apiKey: string,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<ScannedRecipe> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: RECIPE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extract this recipe as JSON." },
          ],
        },
      ],
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) throw new ReceiptError("Your Anthropic API key was rejected. Check it in Settings.");
    if (err.status === 429) throw new ReceiptError("Rate limited by the API. Wait a moment and try again.");
    throw new ReceiptError(err.message || "Couldn't reach the API. Check your connection and key.");
  }
  if (resp.stop_reason === "refusal") throw new ReceiptError("That image couldn't be processed. Please use a photo of a recipe.");
  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new ReceiptError("The recipe couldn't be read. Try a clearer photo.");
  return parseRecipe(textBlock.text);
}

const TEXT_SYSTEM_PROMPT = `You are a recipe assistant for a meal-planning app. You will be given a plain-text list of ingredients (and optionally steps or a title). Turn it into a structured recipe JSON. Default servings to 1 (a meal for one average person) unless the text clearly states otherwise. Use general ingredient names. Convert each quantity into one US unit from this set only: each, cup, tbsp, tsp, oz. Classify each ingredient into Protein, Fruit, Veggie, or Pantry (dairy/grains/sauces/oils/other packaged = Pantry). Choose the single best meal: breakfast, lunch, snack, or dinner. Pick one food emoji. Return only the JSON below — no other text.

{
  "name": "string",
  "emoji": "string (one emoji)",
  "servings": number,
  "meal": "breakfast | lunch | snack | dinner",
  "ingredients": [ { "food": "string", "quantity": number, "unit": "each | cup | tbsp | tsp | oz", "category": "Protein | Fruit | Veggie | Pantry" } ],
  "steps": ["string"]
}`;

/** Build a recipe from pasted text via Claude. */
export async function buildRecipeFromText(apiKey: string, text: string): Promise<ScannedRecipe> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: TEXT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Here is the recipe text:\n\n${text}\n\nBuild it into a recipe as JSON.` }],
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) throw new ReceiptError("Your Anthropic API key was rejected. Check it in Settings.");
    if (err.status === 429) throw new ReceiptError("Rate limited by the API. Wait a moment and try again.");
    throw new ReceiptError(err.message || "Couldn't reach the API. Check your connection and key.");
  }
  if (resp.stop_reason === "refusal") throw new ReceiptError("That text couldn't be processed into a recipe.");
  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new ReceiptError("Couldn't read a recipe from that text.");
  return parseRecipe(textBlock.text);
}

// ---- No-key local text parser (best effort) ----

const UNIT_WORDS: Record<string, Unit> = {
  cup: "cup", cups: "cup", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", oz: "oz", ounce: "oz", ounces: "oz",
  each: "each", clove: "each", cloves: "each", slice: "each", slices: "each",
};
const CAT_WORDS: { re: RegExp; cat: ScannedRecipeIngredient["category"] }[] = [
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
const UNIT_WORDS_LOCAL: Record<string, Unit> = {
  ...UNIT_WORDS,
  pinch: "tsp", dash: "tsp", handful: "cup", bunch: "each", can: "each", jar: "each",
  package: "each", pkg: "each", stick: "each", head: "each", stalk: "each", sprig: "each",
};

function parseQtyToken(s: string): number {
  // handles "1", "1.5", "1/2", "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
}
function guessCat(name: string): ScannedRecipeIngredient["category"] {
  for (const { re, cat } of CAT_WORDS) if (re.test(name)) return cat;
  return "Pantry";
}
function cleanName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parentheticals
    .split(/[^a-z0-9-]+/)
    .filter((t) => t && !FILLER.has(t));
  const name = tokens.join(" ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

/** Best-effort local parse (used when no API key is set). */
export function parseTextLocally(text: string): ScannedRecipe {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // A short first line with no quantity is likely the title.
  let name = "Pasted recipe";
  let body = lines;
  if (lines.length > 1 && !/\d/.test(lines[0]) && lines[0].split(" ").length <= 6) {
    name = lines[0];
    body = lines.slice(1);
  }

  const ingredients: ScannedRecipeIngredient[] = body
    .map((line) => {
      let s = line
        .replace(/^[-*•]\s*/, "")
        .replace(/\b(to taste|for garnish|for serving|as needed|optional|if desired|divided)\b.*$/gi, " ")
        .split(",")[0]
        .trim();
      if (!s) return null;

      let quantity = 0;
      let unit: Unit = "each";
      // leading quantity (incl. mixed fraction) then optional unit word
      const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*([a-zA-Z.]+)?\s*(.*)$/);
      if (m && m[1]) {
        quantity = parseQtyToken(m[1]);
        const uw = (m[2] || "").toLowerCase().replace(/\.$/, "");
        if (UNIT_WORDS_LOCAL[uw]) { unit = UNIT_WORDS_LOCAL[uw]; s = m[3] || ""; }
        else s = ((m[2] ? m[2] + " " : "") + (m[3] || "")).trim();
      }
      const food = cleanName(s) || cleanName(line);
      if (!food) return null;
      return { food, quantity, unit, category: guessCat(food) };
    })
    .filter((i): i is ScannedRecipeIngredient => i !== null);

  return { name, emoji: "🍽️", servings: 1, meal: "dinner", ingredients, steps: [] };
}

export function demoScanRecipe(): Promise<ScannedRecipe> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          name: "Tofu & Veggie Rice Bowl",
          emoji: "🍚",
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
          ],
        }),
      1100,
    ),
  );
}
