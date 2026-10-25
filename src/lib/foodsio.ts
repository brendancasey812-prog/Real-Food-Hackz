// Bulk CSV import/export for the whole food catalog — the "raw text" path
// for the Food Tracker, and (since they share the same catalog and menu) the
// Groceries and Costs tabs too. Mirrors receipt.ts's CSV round trip: one set
// of headers, a tolerant import, and errors reported per row rather than
// silently dropped or aborting the whole file.

import { stringifyCsv, parseCsv, csvToRecords } from "./csv";
import { parseQuantity } from "./foodtable";
import { normalizeName } from "./receipt";
import { FOOD_CATEGORIES } from "./foodcat";
import type { Food, FoodCategory, InventoryItem, Location, Unit } from "./types";

const LOCATIONS: Location[] = ["fridge", "pantry", "freezer"];
const UNITS: Unit[] = ["each", "cup", "tbsp", "tsp", "oz"];
const CATEGORIES = FOOD_CATEGORIES.map((c) => c.key);

const FOOD_CSV_HEADER = [
  "Name", "Category", "Location", "Unit", "Quantity",
  "Calories per Unit", "Protein", "Carbs", "Fat", "Notes",
];

/** The whole catalog — every food plus how much of it is on hand — as CSV. */
export function foodsToCsv(foods: Food[], inventory: InventoryItem[]): string {
  const rows: string[][] = [FOOD_CSV_HEADER];
  for (const f of foods) {
    const qty = inventory.find((i) => i.foodId === f.id)?.quantity ?? 0;
    rows.push([
      f.name, f.category, f.location, f.unit, String(qty),
      String(f.caloriesPerUnit), String(f.protein), String(f.carbs), String(f.fat),
      f.notes ?? "",
    ]);
  }
  return stringifyCsv(rows);
}

export interface FoodImportRow {
  name: string;
  category: FoodCategory;
  location: Location;
  unit: Unit;
  quantity: number;
  caloriesPerUnit: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface CsvImportResult<T> {
  items: T[];
  /** 1-based row numbers, counting the header as row 1. */
  errors: { row: number; message: string }[];
}

const FOOD_HEADER_ALIASES = {
  name: ["name", "food", "item"],
  category: ["category", "type", "foodtype"],
  location: ["location", "where", "shelf", "storedin"],
  unit: ["unit", "units", "uom"],
  quantity: ["quantity", "qty", "amount", "onhand"],
  caloriesPerUnit: ["caloriesperunit", "calories", "cal", "calunit"],
  protein: ["protein"],
  carbs: ["carbs", "carbohydrates"],
  fat: ["fat"],
  notes: ["notes", "note", "detail"],
} as const;

/**
 * Parse a CSV export (or a hand-built one with the same headers) into food
 * rows — tolerant of reordered columns, header casing, and a missing
 * optional column. A row that can't be read is reported and skipped rather
 * than aborting the whole file or silently dropping it.
 */
export function csvToFoods(text: string): CsvImportResult<FoodImportRow> {
  const rows = parseCsv(text);
  const { header, records } = csvToRecords(rows, FOOD_HEADER_ALIASES);
  const errors: { row: number; message: string }[] = [];

  if (rows.length === 0) return { items: [], errors: [{ row: 0, message: "That file is empty." }] };
  if (header.name === undefined) {
    return {
      items: [],
      errors: [{ row: 1, message: 'No "Name" column found. Expected a header row with Name, Category, Unit, Quantity.' }],
    };
  }

  const num = (s: string) => parseQuantity(s) ?? 0;
  const items: FoodImportRow[] = [];
  records.forEach((rec, i) => {
    const row = i + 2; // header is row 1
    const name = rec.name.trim();
    if (!name) { errors.push({ row, message: "Missing a food name." }); return; }

    const category = (CATEGORIES.find((c) => c === rec.category.trim().toLowerCase()) ?? "condiment") as FoodCategory;
    const location = (LOCATIONS.find((l) => l === rec.location.trim().toLowerCase()) ?? "pantry") as Location;
    const unit = (UNITS.find((u) => u === rec.unit.trim().toLowerCase()) ?? "each") as Unit;

    items.push({
      name,
      category,
      location,
      unit,
      quantity: Math.max(0, num(rec.quantity)),
      caloriesPerUnit: Math.max(0, num(rec.caloriesPerUnit)),
      protein: Math.max(0, num(rec.protein)),
      carbs: Math.max(0, num(rec.carbs)),
      fat: Math.max(0, num(rec.fat)),
      notes: rec.notes.trim() || undefined,
    });
  });

  if (items.length === 0 && errors.length === 0) {
    errors.push({ row: 1, message: "No data rows were found below the header." });
  }
  return { items, errors };
}

/** Match an import row to an existing food by normalized name — the same
 *  matching a receipt scan uses to merge into the catalog rather than
 *  duplicate it. */
export function matchExistingFood(foods: Food[], name: string): Food | undefined {
  const norm = normalizeName(name);
  return foods.find((f) => normalizeName(f.name) === norm);
}
