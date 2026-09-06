// Reading a receipt you pasted in, rather than photographed.
//
// Store receipts and order emails are already text: a line for the item, a
// price on the right, and — for anything sold by weight — the weight and the
// per-pound rate that produced it. That is more than a photo gives us, so this
// path can do something the camera one can't: work out what a unit actually
// costs, not just that you bought some.

import type { Food, FoodCategory, Location, Unit } from "./types";
import { classifyByName } from "./foodclass";

const G_PER_LB = 453.59237;
const G_PER_OZ = 28.349523;

/** One item read off a pasted receipt. */
export interface ReceiptTextLine {
  /** The line the item came from, kept so the review screen can show it. */
  raw: string;
  /** The item as printed, brand and all. */
  label: string;
  /** The food behind the brand: "Belgioioso Ciliegine Mozzarella" → "mozzarella". */
  food: string;
  /** What was paid for this line, in dollars. */
  total: number;
  /** How many of it, when the receipt counts rather than weighs. */
  quantity: number;
  /** Weight in grams, when the line was sold by weight. */
  grams?: number;
  /** Weight of one package, from a size printed in the name ("Tub 32oz"). */
  packGrams?: number;
  /** Volume of one package in fluid ounces, for things sold by liquid measure. */
  packFlOz?: number;
  /** The printed per-pound rate, if there was one. */
  perLb?: number;
  /** The section it appeared under (DELI, PRODUCE, …), as a hint. */
  section?: string;
  category: FoodCategory;
  location: Location;
}

/** Section headings, which are hints rather than items. */
const SECTIONS = new Set([
  "DELI", "PRODUCE", "REFRIG/FROZEN", "REFRIGERATED", "FROZEN", "BAKERY",
  "MEAT", "SEAFOOD", "GROCERY", "DAIRY", "PANTRY", "BEVERAGES", "SNACKS",
  "HOUSEHOLD", "ORDER DETAILS",
]);

/** Lines that are totals, savings or headers rather than things you bought. */
const NOT_AN_ITEM =
  /^(total|subtotal|sales tax|tax|savings|total savings|total items|calculated|order|balance|payment|change|tip|delivery|service fee|bag fee|regular price|you saved|member savings|est\.?\s|thank you)/i;

/**
 * Words that describe the brand or the packaging rather than the food. Dropped
 * so "Dannon Oikos Triple Zero Plain Tub 32oz" files under yogurt, and the
 * catalogue stays a list of foods rather than a list of products.
 */
const BRANDISH = new Set([
  "organic", "fresh", "large", "small", "jumbo", "mini", "family", "value",
  "pack", "tub", "bag", "box", "jar", "can", "bottle", "carton", "chilled",
  "frozen", "refrigerated", "low", "fat", "nonfat", "whole", "reduced",
  "triple", "zero", "plain", "original", "classic", "premium", "select",
  "signature", "brand", "farms", "farm", "co", "company", "inc", "natural",
  "naturals", "grade", "aa", "a", "the", "of", "and", "with", "puck", "spread",
  "each", "ct", "count", "oz", "lb", "lbs", "fl", "fz", "floz", "g", "kg", "ml", "l",
]);

/**
 * The food inside a product name. Brands sit at the front and packaging at the
 * back, so what survives dropping both is usually the thing itself.
 */
export function foodFromLabel(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9%&\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    // A token that is just a size ("32oz", "64fz", "2%") is packaging.
    .filter((w) => !/^\d+(\.\d+)?(oz|fz|floz|lb|g|kg|ml|l|ct|pk|%)?$/.test(w))
    .filter((w) => !BRANDISH.has(w));
  // Receipts often print "Onions Red" or "Apples Fuji" — noun first, variety
  // after — so the leading words are the ones that identify the food.
  return words.slice(0, 3).join(" ").trim() || label.trim().toLowerCase();
}

const money = (s: string) => Number(s.replace(/[$,]/g, ""));

/** Fluid ounces in a US cup, for package sizes printed in liquid measure. */
export const FL_OZ_PER_CUP = 8;

/**
 * The pack size hiding in a product name: "Tub 32oz", "Barista Chilled 64fz",
 * "1 gal". Receipts count packages, so without this a gallon of milk and a
 * carton of cream are both "1" and their prices are nonsense.
 *
 * Liquid and weight are kept apart: 64 fl oz of oat milk is exactly 8 cups,
 * while 32 oz of yogurt is a weight that needs the food's density.
 */
export function packSizeFrom(label: string): { grams?: number; flOz?: number } {
  const l = label.toLowerCase();

  const liquid = l.match(/([\d.]+)\s*(fl\s?oz|floz|fz)\b/);
  if (liquid) {
    const n = Number(liquid[1]);
    if (Number.isFinite(n) && n > 0) return { flOz: n };
  }
  const gallon = l.match(/([\d.]+)\s*(gal|gallon)\b/);
  if (gallon) {
    const n = Number(gallon[1]);
    if (Number.isFinite(n) && n > 0) return { flOz: n * 128 };
  }
  const quart = l.match(/([\d.]+)\s*(qt|quart)\b/);
  if (quart) {
    const n = Number(quart[1]);
    if (Number.isFinite(n) && n > 0) return { flOz: n * 32 };
  }
  const litre = l.match(/([\d.]+)\s*(ml|l)\b/);
  if (litre) {
    const n = Number(litre[1]) * (litre[2] === "l" ? 1000 : 1);
    if (Number.isFinite(n) && n > 0) return { flOz: n / 29.5735 };
  }

  const weight = l.match(/([\d.]+)\s*(oz|lb|lbs|kg|g)\b/);
  if (weight) {
    const n = Number(weight[1]);
    const per: Record<string, number> = { oz: G_PER_OZ, lb: G_PER_LB, lbs: G_PER_LB, kg: 1000, g: 1 };
    const grams = n * (per[weight[2]] ?? 0);
    if (Number.isFinite(grams) && grams > 0) return { grams };
  }
  return {};
}

/**
 * Parse pasted receipt text into items.
 *
 * Handles the two shapes receipts use: a plain "name … $price" line, and a
 * weighed "name - 1.05lb @6.99/lb … $7.34" line. A "Quantity: n" line that
 * follows attaches to the item above it, which is how most order summaries
 * lay it out.
 */
export function parseReceiptText(text: string): ReceiptTextLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ReceiptTextLine[] = [];
  let section: string | undefined;

  for (const line of lines) {
    const upper = line.toUpperCase().replace(/[^A-Z/\s]/g, "").trim();
    if (SECTIONS.has(upper)) {
      section = upper;
      continue;
    }

    // "Quantity: 2" belongs to the item above.
    const qty = line.match(/^quantity:\s*([\d.]+)/i);
    if (qty && out.length > 0) {
      const n = Number(qty[1]);
      const last = out[out.length - 1];
      if (Number.isFinite(n) && n > 0) {
        // A weighed line already carries its amount; a counted one multiplies.
        if (last.grams == null) last.quantity = n;
      }
      continue;
    }

    if (NOT_AN_ITEM.test(line)) continue;

    // The price is the last money figure on the line.
    const prices = [...line.matchAll(/\$\s?([\d,]+\.\d{2})/g)];
    if (prices.length === 0) continue;
    const total = money(prices[prices.length - 1][1]);
    if (!Number.isFinite(total) || total <= 0) continue;

    // Everything before the price, minus the tab/space gutter, is the label.
    let label = line.slice(0, prices[prices.length - 1].index).trim();
    label = label.replace(/[\t\s]+$/, "").replace(/[.\-–—]+$/, "").trim();
    if (!label) continue;

    // "- 1.05lb @6.99/lb" — weight sold by the pound.
    const weighed = label.match(/-\s*([\d.]+)\s*(lb|lbs|oz)\b\s*(?:@\s*\$?([\d.]+)\s*\/\s*(lb|oz))?/i);
    let grams: number | undefined;
    let perLb: number | undefined;
    if (weighed) {
      const amount = Number(weighed[1]);
      const unit = weighed[2].toLowerCase();
      if (Number.isFinite(amount)) {
        grams = unit === "oz" ? amount * G_PER_OZ : amount * G_PER_LB;
      }
      if (weighed[3]) {
        const rate = Number(weighed[3]);
        perLb = weighed[4].toLowerCase() === "oz" ? rate * 16 : rate;
      }
      label = label.slice(0, weighed.index).replace(/[-–—\s]+$/, "").trim();
    }

    const food = foodFromLabel(label);
    const placed = classifyByName(food) ?? classifyByName(label);
    const pack = weighed ? {} : packSizeFrom(label);
    out.push({
      raw: line,
      label,
      food,
      total,
      quantity: 1,
      grams,
      packGrams: pack.grams,
      packFlOz: pack.flOz,
      perLb,
      section,
      category: placed?.category ?? "condiment",
      location: placed?.location ?? sectionLocation(section),
    });
  }

  return out;
}

/** Where a receipt section suggests the food is kept. */
function sectionLocation(section: string | undefined): Location {
  if (!section) return "pantry";
  if (section.includes("FROZEN") && !section.includes("REFRIG")) return "freezer";
  if (/REFRIG|DELI|DAIRY|MEAT|SEAFOOD|PRODUCE/.test(section)) return "fridge";
  return "pantry";
}

/**
 * How much of a food a receipt line represents, in the food's own unit.
 *
 * Weight is the honest case: given how much a unit weighs, pounds convert to
 * cups or ounces exactly. Without that weight there is nothing to convert
 * with, and the caller has to ask rather than guess.
 */
export function amountInUnit(
  line: ReceiptTextLine,
  unit: Unit,
  gramsPerUnit: number | null,
): number | null {
  const byWeight = (grams: number, packs = 1) => {
    if (unit === "oz") return round2((grams * packs) / G_PER_OZ);
    if (gramsPerUnit == null || gramsPerUnit <= 0) return null;
    return round2((grams * packs) / gramsPerUnit);
  };

  // Sold by weight: the receipt already says exactly how much.
  if (line.grams != null) return byWeight(line.grams);

  // Sold by the package, with a size printed on it. Liquid measure converts
  // exactly; weight goes through the food's own density.
  if (line.packFlOz != null) {
    const cups = (line.packFlOz / FL_OZ_PER_CUP) * line.quantity;
    if (unit === "cup") return round2(cups);
    if (unit === "tbsp") return round2(cups * 16);
    if (unit === "tsp") return round2(cups * 48);
    if (unit === "oz" && gramsPerUnit != null) return round2((cups * 236.6) / G_PER_OZ);
  }
  if (line.packGrams != null && unit !== "each") {
    return byWeight(line.packGrams, line.quantity);
  }

  // Counted, with nothing to convert by: one of something is one of it.
  if (unit === "each") return line.quantity;
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What one unit cost, given what the line cost and how much it held. */
export function unitPrice(total: number, amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((total / amount) * 1e4) / 1e4;
}

// ---- Matching a receipt line to the catalogue ----

/** One candidate food for a receipt line, with why it was suggested. */
export interface FoodSuggestion {
  food: Food;
  /** 0-1, higher is better. */
  score: number;
  /** The words that made it match, for showing the user. */
  matched: string[];
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

/**
 * Two words are the same thing if one contains the other: "onions" covers
 * "onion", and "oatmilk" covers both "oat" and "milk" — which is how a brand
 * that runs words together still finds the right food.
 */
const alike = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

/**
 * Rank catalogue foods against a receipt line.
 *
 * Scored by how *rare* the matching words are across the catalogue, not how
 * many there are. Common words are nearly free and rare ones are decisive:
 * "Boursin Garlic & Herb" shares "garlic" with two foods but "boursin" with
 * exactly one, so it lands on the cheese rather than the bulb. Counting words
 * instead gets that backwards every time.
 */
export function rankFoods(
  foods: Food[],
  query: string,
  limit = 4,
  /** What the line looks like from its name — a strong tiebreak between two
   *  foods that share a word, like pepper the spice and pepper the vegetable. */
  hint?: FoodCategory,
): FoodSuggestion[] {
  const q = words(query);
  if (q.length === 0) return [];

  // How many foods use each word — a word in one name is worth far more than
  // one in ten.
  const df = new Map<string, number>();
  const catalogue = foods.map((f) => ({ food: f, tokens: words(f.name) }));
  for (const { tokens } of catalogue) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const weight = (t: string) => Math.log(foods.length / (1 + (df.get(t) ?? 0))) + 1;

  // A query word no catalogue food uses at all — a brand, a marketing word —
  // can never be matched, so counting it against every candidate only adds
  // noise. Set it aside and charge a small flat cost for having it.
  const informative = q.filter((t) => catalogue.some((c) => c.tokens.some((x) => alike(t, x))));
  const noise = q.length - informative.length;
  const askedTotal = informative.reduce((sum, t) => sum + weight(t), 0);

  const scored = catalogue.map(({ food, tokens }) => {
    const matched = tokens.filter((t) => q.some((x) => alike(x, t)));
    if (matched.length === 0 || askedTotal === 0) return { food, score: 0, matched };

    // How much of the food's own name the line accounts for.
    const covered =
      matched.reduce((sum, t) => sum + weight(t), 0) /
      tokens.reduce((sum, t) => sum + weight(t), 0);

    // How much of the line the food accounts for — weighted by rarity, so
    // leaving "boursin" unexplained costs far more than leaving "garlic".
    const explained =
      informative.filter((t) => tokens.some((x) => alike(t, x)))
        .reduce((sum, t) => sum + weight(t), 0) / askedTotal;

    // Explaining the line matters more than being fully explained by it:
    // otherwise every one-word food beats every specific one.
    const agrees = hint != null && food.category === hint ? 1.25 : 1;
    const score = Math.min(1, Math.sqrt(covered) * explained ** 1.5 * 0.92 ** noise * agrees);
    return { food, score, matched };
  });

  return scored
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit);
}
