// CSV import/export for one store's prices — the Costs tab's raw-text path.
// Prices are store-scoped (unlike the food catalog), so this stays a
// separate small module rather than folding into foodsio.ts, but shares the
// same csv.ts engine and the same tolerant-import shape as every other
// CSV round trip in the app.

import { stringifyCsv, parseCsv, csvToRecords } from "./csv";
import { parseQuantity } from "./foodtable";
import { normalizeName } from "./receipt";
import type { Food } from "./types";

const PRICE_CSV_HEADER = ["Food", "Unit", "Price (USD)"];

/** One store's prices as CSV — blank for a food with no price there yet. */
export function pricesToCsv(foods: Food[], priceForFood: (foodId: string) => number | null): string {
  const rows: string[][] = [PRICE_CSV_HEADER];
  for (const f of foods) {
    const p = priceForFood(f.id);
    rows.push([f.name, f.unit, p == null ? "" : p.toFixed(4)]);
  }
  return stringifyCsv(rows);
}

export interface PriceImportRow {
  food: Food;
  pricePerUnit: number;
}

export interface PriceImportResult {
  items: PriceImportRow[];
  /** 1-based row numbers, counting the header as row 1. */
  errors: { row: number; message: string }[];
}

const PRICE_HEADER_ALIASES = {
  food: ["food", "item", "name", "ingredient"],
  price: ["priceusd", "price", "priceperunit", "cost", "costusd"],
} as const;

/**
 * Parse a prices CSV against the foods already in the kitchen. A row naming
 * a food that doesn't exist yet is reported rather than silently creating
 * one — a price sheet isn't the place to invent new foods, the Food Tracker
 * is. A blank price cell is skipped quietly (nothing to set), not an error.
 */
export function csvToPrices(text: string, foods: Food[]): PriceImportResult {
  const rows = parseCsv(text);
  const { header, records } = csvToRecords(rows, PRICE_HEADER_ALIASES);
  const errors: { row: number; message: string }[] = [];

  if (rows.length === 0) return { items: [], errors: [{ row: 0, message: "That file is empty." }] };
  if (header.food === undefined) {
    return {
      items: [],
      errors: [{ row: 1, message: 'No "Food" column found. Expected a header row with Food and Price.' }],
    };
  }

  const items: PriceImportRow[] = [];
  records.forEach((rec, i) => {
    const row = i + 2; // header is row 1
    const name = rec.food.trim();
    if (!name) { errors.push({ row, message: "Missing a food name." }); return; }

    const priceText = rec.price.trim();
    if (!priceText) return; // nothing to set — not an error

    const price = parseQuantity(priceText);
    if (price === null || price < 0) {
      errors.push({ row, message: `Couldn't read the price "${rec.price}".` });
      return;
    }

    const norm = normalizeName(name);
    const food = foods.find((f) => normalizeName(f.name) === norm);
    if (!food) {
      errors.push({ row, message: `No food named "${name}" in your kitchen — add it on the Food Tracker first.` });
      return;
    }

    items.push({ food, pricePerUnit: price });
  });

  return { items, errors };
}
