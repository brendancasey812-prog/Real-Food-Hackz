import { askClaude, parseJsonLoose, ReceiptError } from "./aiclient";
import { parseCsv, stringifyCsv, csvToRecords } from "./csv";
import { parseQuantity } from "./foodtable";
import { classifyByName } from "./foodclass";
import type { FoodCategory, Location, ScanResult, ScannedItem, Unit } from "./types";

export { ReceiptError } from "./aiclient";

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

/** Parse and validate the model's JSON into a ScanResult. */
function parseScan(text: string): ScanResult {
  const data = parseJsonLoose(text, "The receipt couldn't be read. Try a clearer, straight-on photo.");
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
      estimated: Boolean(i.estimated)
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
  const text = await askClaude(
    apiKey,
    RECEIPT_SYSTEM_PROMPT,
    "Extract the food items from this receipt as JSON.",
    {
      image: { media_type: mediaType, data: base64 },
      noKeyMessage: "Add your Anthropic API key in Settings to scan a real photo — or try a sample.",
      refusalMessage: "The image couldn't be processed. Please use a photo of a grocery receipt.",
      serverErrorMessage: "The receipt service failed. Try again.",
    },
  );
  return parseScan(text);
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
          ]
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
  { category: FoodCategory; location: Location }
> = {
  Protein: { category: "protein", location: "fridge"},
  Fruit: { category: "fruit", location: "fridge"},
  Veggie: { category: "vegetable", location: "fridge"},
  Pantry: { category: "condiment", location: "pantry"}
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

// ---- CSV round trip (works with no API key at all) ----
//
// A scan is reviewed as a table already; CSV just gives that table a life
// outside the app — edited in a spreadsheet, merged with another list, kept
// as a record — and a way back in that never needed the AI to begin with.
// Import and export share one column set, so a file this app wrote is always
// a file this app can read back exactly.

const RECEIPT_CSV_HEADER = ["Category", "Food", "Variant", "Quantity", "Unit", "Estimated"];

/** Scanned/reviewed items → CSV text, ready for `download()`. */
export function scannedItemsToCsv(items: ScannedItem[]): string {
  const rows: string[][] = [RECEIPT_CSV_HEADER];
  for (const it of items) {
    rows.push([it.category, it.food, it.variant ?? "", String(it.quantity), it.unit, it.estimated ? "yes" : ""]);
  }
  return stringifyCsv(rows);
}

/** The result of a CSV import: what could be read, and what couldn't. */
export interface CsvImportResult<T> {
  items: T[];
  /** 1-based row numbers, counting the header as row 1, so they line up with
   *  what a person sees in a spreadsheet. */
  errors: { row: number; message: string }[];
}

const RECEIPT_HEADER_ALIASES = {
  category: ["category", "type", "foodtype", "cat"],
  food: ["food", "item", "name", "product", "description"],
  variant: ["variant", "detail", "notes", "note"],
  quantity: ["quantity", "qty", "amount"],
  unit: ["unit", "units", "uom"],
  estimated: ["estimated", "est"],
} as const;

/**
 * Parse a CSV export (or a hand-built one with the same headers) back into
 * ScannedItems — tolerant of reordered columns, header casing/punctuation, a
 * missing optional column, and blank rows. A row that can't be read is
 * reported and skipped rather than aborting the whole file or silently
 * dropping it, so a person editing the export finds out exactly which line
 * needs fixing.
 */
export function csvToScannedItems(text: string): CsvImportResult<ScannedItem> {
  const rows = parseCsv(text);
  const { header, records } = csvToRecords(rows, RECEIPT_HEADER_ALIASES);
  const errors: { row: number; message: string }[] = [];

  if (rows.length === 0) {
    return { items: [], errors: [{ row: 0, message: "That file is empty." }] };
  }
  if (header.food === undefined) {
    return {
      items: [],
      errors: [{ row: 1, message: 'No "Food" column found. Expected a header row with Food, Quantity, Unit, Category.' }],
    };
  }

  const items: ScannedItem[] = [];
  records.forEach((rec, i) => {
    const row = i + 2; // header is row 1, so the first data row is row 2
    const food = rec.food.trim();
    if (!food) { errors.push({ row, message: "Missing a food name." }); return; }

    const qty = parseQuantity(rec.quantity);
    if (qty === null || qty <= 0) {
      errors.push({ row, message: rec.quantity ? `Couldn't read the quantity "${rec.quantity}".` : "Missing a quantity." });
      return;
    }

    const category = (VALID_CATEGORIES.find((c) => c.toLowerCase() === rec.category.trim().toLowerCase()) ??
      "Pantry") as ScannedItem["category"];
    const unit = (VALID_UNITS.find((u) => u === rec.unit.trim().toLowerCase()) ?? "each") as ScannedItem["unit"];

    items.push({
      category,
      food,
      variant: rec.variant.trim(),
      quantity: qty,
      unit,
      estimated: /^(y|yes|true|1|est)/i.test(rec.estimated.trim()),
    });
  });

  if (items.length === 0 && errors.length === 0) {
    errors.push({ row: 1, message: "No data rows were found below the header." });
  }
  return { items, errors };
}
