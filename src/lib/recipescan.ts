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

export const RECIPE_SYSTEM_PROMPT = `You are a recipe-scanning assistant for a meal-planning app. You will be given a photo of a recipe (a card, cookbook page, or handwritten note). Extract the recipe into JSON. Use general, human-readable ingredient names. Convert each ingredient quantity into one US unit from this set only: each, cup, tbsp, tsp, oz. Classify each ingredient into Protein, Fruit, Veggie, or Pantry (dairy/grains/sauces/oils/other packaged = Pantry). Choose the single best meal for the recipe: breakfast, lunch, snack, or dinner. Pick one food emoji that represents the dish. Return only the JSON below — no other text.

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
      quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
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
