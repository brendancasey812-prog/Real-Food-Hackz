import Anthropic from "@anthropic-ai/sdk";
import { classifyByName } from "./foodclass";
import type { FoodCategory, Location, ScanResult, ScannedItem, Unit } from "./types";

/** Vision model used for receipt OCR + extraction. */
const MODEL = "claude-opus-5";

export const RECEIPT_SYSTEM_PROMPT = `You are a receipt-scanning assistant for a fridge and pantry inventory tracker. You will be given a photo of a grocery store receipt. Extract every food item and classify each into one of four categories: Protein (meat, poultry, fish, eggs, tofu), Fruit (fresh or dried fruit), Veggie (fresh vegetables, salad greens, herbs), or Pantry (grains, dairy, sauces, condiments, beverages, tortillas, and other shelf-stable/packaged items). Use general, human-readable food names rather than receipt abbreviations, and normalize variants to a common title (e.g., "Ground Beef 80/20" and "Organic Ground Beef" both become "Ground Beef"), storing any specific detail like fat ratio or "organic" in a separate variant field. Convert quantities into US standard units (lb, oz, each, dozen, head). If a package's exact size isn't printed on the receipt, estimate using a typical size for that item and mark it as estimated. Exclude non-food line items (bag fees, coupons) and list them separately with a brief reason. Return only the JSON described below — no other commentary.

JSON schema:
{
  "items": [
    { "category": "Protein | Fruit | Veggie | Pantry", "food": "string (general name)", "variant": "string (optional detail, e.g. '80/20', 'organic')", "quantity": number, "unit": "lb | oz | each | dozen | head", "estimated": true/false }
  ],
  "excluded_items": [ { "raw_text": "string", "reason": "string" } ]
}`;

const VALID_CATEGORIES = ["Protein", "Fruit", "Veggie", "Pantry"];
const VALID_UNITS = ["lb", "oz", "each", "dozen", "head"];

export class ReceiptError extends Error {}

/** Strip markdown fences and parse the model's JSON, validating the shape. */
function parseScan(text: string): ScanResult {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Best-effort: pull the first {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new ReceiptError("The receipt couldn't be read. Try a clearer, straight-on photo.");
    data = JSON.parse(match[0]);
  }
  const obj = data as Partial<ScanResult>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const excluded = Array.isArray(obj.excluded_items) ? obj.excluded_items : [];
  const clean = items
    .filter((i) => i && VALID_CATEGORIES.includes(i.category) && VALID_UNITS.includes(i.unit) && i.food)
    .map((i) => ({
      category: i.category,
      food: String(i.food).trim(),
      variant: i.variant ? String(i.variant).trim() : "",
      quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      unit: i.unit,
      estimated: Boolean(i.estimated),
    }));
  if (clean.length === 0) {
    throw new ReceiptError(
      "No food items were found. Make sure the whole receipt is in frame and readable, then try again.",
    );
  }
  return { items: clean, excluded_items: excluded };
}

/** Call Claude's vision model to read a receipt image (data is base64, no prefix). */
export async function scanReceipt(
  apiKey: string,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<ScanResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: RECEIPT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extract the food items from this receipt as JSON." },
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
  if (resp.stop_reason === "refusal") {
    throw new ReceiptError("The image couldn't be processed. Please use a photo of a grocery receipt.");
  }
  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ReceiptError("The receipt couldn't be read. Try a clearer photo.");
  }
  return parseScan(textBlock.text);
}

/** A realistic sample scan, so the whole flow works without an API key. */
export function demoScan(): Promise<ScanResult> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          items: [
            { category: "Protein", food: "Ground Beef", variant: "80/20", quantity: 1, unit: "lb", estimated: false },
            { category: "Protein", food: "Chicken breast", variant: "", quantity: 2, unit: "lb", estimated: false },
            { category: "Protein", food: "Eggs", variant: "large", quantity: 1, unit: "dozen", estimated: false },
            { category: "Fruit", food: "Bananas", variant: "", quantity: 6, unit: "each", estimated: true },
            { category: "Fruit", food: "Apples", variant: "Honeycrisp", quantity: 4, unit: "each", estimated: true },
            { category: "Veggie", food: "Broccoli", variant: "", quantity: 1, unit: "head", estimated: false },
            { category: "Veggie", food: "Spinach", variant: "organic", quantity: 5, unit: "oz", estimated: false },
            { category: "Pantry", food: "Milk", variant: "2%", quantity: 1, unit: "each", estimated: false },
            { category: "Pantry", food: "Brown rice", variant: "", quantity: 32, unit: "oz", estimated: false },
            { category: "Pantry", food: "Olive oil", variant: "extra virgin", quantity: 17, unit: "oz", estimated: true },
          ],
          excluded_items: [
            { raw_text: "BAG FEE 0.10", reason: "Not a food item (bag fee)" },
            { raw_text: "COUPON -1.50", reason: "Discount, not a purchased item" },
          ],
        }),
      1100,
    ),
  );
}

// ---- Merge helpers (receipt world → our Kitchen model) ----

/** Normalize a food name for matching ("Organic Bananas" ≈ "banana"). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(organic|fresh|large|small|whole)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/s\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_MAP: Record<
  ScannedItem["category"],
  { category: FoodCategory; location: Location; emoji: string }
> = {
  Protein: { category: "protein", location: "fridge", emoji: "🥩" },
  Fruit: { category: "fruit", location: "fridge", emoji: "🍎" },
  Veggie: { category: "vegetable", location: "fridge", emoji: "🥦" },
  Pantry: { category: "condiment", location: "pantry", emoji: "🥫" },
};

/**
 * Where a scanned line belongs.
 *
 * The scanner's four buckets are coarse — everything it can't call produce or
 * meat comes back as "Pantry" — so the name gets the final say when it says
 * something specific. That is what keeps shallots out of the condiment shelf.
 */
export function mapCategory(cat: ScannedItem["category"], name?: string) {
  const coarse = CATEGORY_MAP[cat];
  const byName = name ? classifyByName(name) : null;
  return byName ? { ...coarse, ...byName } : coarse;
}

/** The Unit a brand-new food gets, derived from the receipt unit. */
export function unitForNewFood(u: ScannedItem["unit"]): Unit {
  if (u === "lb" || u === "oz") return "oz";
  return "each"; // each | dozen | head
}

const OZ_PER: Record<string, number> = { lb: 16, oz: 1 };
const EACH_PER: Record<string, number> = { each: 1, dozen: 12, head: 1 };

/**
 * Convert a scanned (quantity, unit) into a target food's unit for summing.
 * Returns null when the families are incompatible (e.g. a weight into a cup food).
 */
export function convertToUnit(qty: number, from: ScannedItem["unit"], to: Unit): number | null {
  if (to === "oz") return from in OZ_PER ? qty * OZ_PER[from] : null;
  if (to === "each") return from in EACH_PER ? qty * EACH_PER[from] : null;
  // cup / tbsp / tsp — no clean conversion from weight/count receipt units.
  return null;
}
