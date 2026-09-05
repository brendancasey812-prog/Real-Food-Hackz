// Tabular food-list parsing.
//
// People rarely paste prose recipes — they paste a table out of a spreadsheet,
// a doc, or a nutrition tracker:
//
//   Food<TAB>Quantity<TAB>Unit<TAB>Serving Size Number<TAB>...<TAB>Total Calories
//   Farfalle Pasta De Cecco<TAB>8<TAB>cups dry<TAB>1<TAB>cup dry<TAB>200<TAB>1600
//   TOTAL<TAB>...<TAB>2974
//   PER SERVING (6 servings)<TAB>...<TAB>496
//
// This module turns that into structured rows: it finds the delimiter, maps the
// header to known roles, converts units, and does the serving-size calorie math
// (a "Calories per Unit" column is calories per *serving size*, not per app unit).

import type { Unit } from "./types";

/** One ingredient row lifted out of a pasted table. */
export interface FoodTableRow {
  food: string;
  /** Quantity expressed in `unit` (already converted from lb/g/ml/…). */
  quantity: number;
  unit: Unit;
  /** Prep/state qualifier that rode along in the unit cell ("dry", "chopped"). */
  note?: string;
  /** Calories in one `unit`, derived from the calorie columns. */
  caloriesPerUnit?: number;
  /** Calories for the whole row (given, or derived). */
  totalCalories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface FoodTable {
  rows: FoodTableRow[];
  /** Title line found above the table, if any. */
  title?: string;
  /** From a "PER SERVING (6 servings)" / "Servings: 6" row. */
  servings?: number;
  /** Calories the table itself claims — used to sanity-check our math. */
  declaredTotalCalories?: number;
  declaredPerServingCalories?: number;
}

// ---- Numbers ----

const VULGAR: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2, "⅖": 0.4,
  "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875
};

/** "1", "1.5", "1/2", "1 1/2", "1½", "2-3" (→ 2), "1,200" → number. */
export function parseQuantity(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/(\d),(?=\d{3}\b)/g, "$1"); // thousands separator
  s = s.split(/\s*(?:-|–|—|to)\s*/)[0].trim(); // a range takes its low end
  let extra = 0;
  s = s.replace(new RegExp(`[${Object.keys(VULGAR).join("")}]`, "g"), (ch) => {
    extra += VULGAR[ch];
    return " ";
  });
  s = s.trim();
  if (!s) return extra || null;
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) + extra;
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) + extra : null;
  const num = s.match(/^\d*\.?\d+$/);
  if (num) return Number(s) + extra;
  return extra || null;
}

/** A cell that is *only* a number (used to tell headers from data). */
function numericCell(raw: string): number | null {
  const s = raw.trim().replace(/[$,]/g, "");
  if (!s) return null;
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : parseQuantity(s);
}

// ---- Units ----

/** unit word → app unit + how many app units one of it is. */
const UNIT_TABLE: Record<string, { unit: Unit; factor: number }> = {
  cup: { unit: "cup", factor: 1 }, cups: { unit: "cup", factor: 1 }, c: { unit: "cup", factor: 1 },
  tbsp: { unit: "tbsp", factor: 1 }, tbsps: { unit: "tbsp", factor: 1 }, tbs: { unit: "tbsp", factor: 1 },
  tb: { unit: "tbsp", factor: 1 }, tablespoon: { unit: "tbsp", factor: 1 }, tablespoons: { unit: "tbsp", factor: 1 },
  tsp: { unit: "tsp", factor: 1 }, tsps: { unit: "tsp", factor: 1 }, teaspoon: { unit: "tsp", factor: 1 },
  teaspoons: { unit: "tsp", factor: 1 },
  oz: { unit: "oz", factor: 1 }, ozs: { unit: "oz", factor: 1 }, ounce: { unit: "oz", factor: 1 },
  ounces: { unit: "oz", factor: 1 }, floz: { unit: "oz", factor: 1 },
  lb: { unit: "oz", factor: 16 }, lbs: { unit: "oz", factor: 16 }, pound: { unit: "oz", factor: 16 },
  pounds: { unit: "oz", factor: 16 },
  g: { unit: "oz", factor: 1 / 28.3495 }, gram: { unit: "oz", factor: 1 / 28.3495 },
  grams: { unit: "oz", factor: 1 / 28.3495 }, gs: { unit: "oz", factor: 1 / 28.3495 },
  kg: { unit: "oz", factor: 35.274 }, kilogram: { unit: "oz", factor: 35.274 }, kilograms: { unit: "oz", factor: 35.274 },
  ml: { unit: "cup", factor: 1 / 236.588 }, milliliter: { unit: "cup", factor: 1 / 236.588 },
  milliliters: { unit: "cup", factor: 1 / 236.588 },
  l: { unit: "cup", factor: 4.2268 }, liter: { unit: "cup", factor: 4.2268 }, liters: { unit: "cup", factor: 4.2268 },
  pint: { unit: "cup", factor: 2 }, pints: { unit: "cup", factor: 2 },
  quart: { unit: "cup", factor: 4 }, quarts: { unit: "cup", factor: 4 }, qt: { unit: "cup", factor: 4 },
  gallon: { unit: "cup", factor: 16 }, gallons: { unit: "cup", factor: 16 },
  pinch: { unit: "tsp", factor: 0.125 }, pinches: { unit: "tsp", factor: 0.125 },
  dash: { unit: "tsp", factor: 0.125 }, dashes: { unit: "tsp", factor: 0.125 },
  handful: { unit: "cup", factor: 1 }, handfuls: { unit: "cup", factor: 1 },
  each: { unit: "each", factor: 1 }, ea: { unit: "each", factor: 1 }, count: { unit: "each", factor: 1 },
  ct: { unit: "each", factor: 1 }, piece: { unit: "each", factor: 1 }, pieces: { unit: "each", factor: 1 },
  serving: { unit: "each", factor: 1 }, servings: { unit: "each", factor: 1 },
  clove: { unit: "each", factor: 1 }, cloves: { unit: "each", factor: 1 },
  slice: { unit: "each", factor: 1 }, slices: { unit: "each", factor: 1 },
  can: { unit: "each", factor: 1 }, cans: { unit: "each", factor: 1 },
  jar: { unit: "each", factor: 1 }, jars: { unit: "each", factor: 1 },
  package: { unit: "each", factor: 1 }, packages: { unit: "each", factor: 1 }, pkg: { unit: "each", factor: 1 },
  stick: { unit: "each", factor: 1 }, sticks: { unit: "each", factor: 1 },
  head: { unit: "each", factor: 1 }, heads: { unit: "each", factor: 1 },
  stalk: { unit: "each", factor: 1 }, stalks: { unit: "each", factor: 1 },
  sprig: { unit: "each", factor: 1 }, sprigs: { unit: "each", factor: 1 },
  bunch: { unit: "each", factor: 1 }, bunches: { unit: "each", factor: 1 },
  dozen: { unit: "each", factor: 12 },
  breast: { unit: "each", factor: 1 }, breasts: { unit: "each", factor: 1 },
  fillet: { unit: "each", factor: 1 }, fillets: { unit: "each", factor: 1 },
  whole: { unit: "each", factor: 1 }
};

export interface ParsedUnit {
  unit: Unit;
  /** app units per one written unit (lb → 16 oz). */
  factor: number;
  /** Everything else in the cell: "dry", "chopped", "minced", "cooked". */
  modifier?: string;
}

/**
 * Read a unit cell that may carry a state qualifier: "cups dry", "cup chopped",
 * "tsp minced", "fl oz". Returns the app unit plus the qualifier as a note.
 */
export function parseUnitCell(raw: string | undefined): ParsedUnit | null {
  if (!raw) return null;
  const words = raw.toLowerCase().replace(/[().]/g, " ").split(/[^a-z]+/).filter(Boolean);
  if (!words.length) return null;
  // "fl oz" / "fluid ounces" collapse to one token before lookup.
  const tokens = words[0] === "fl" || words[0] === "fluid" ? ["floz", ...words.slice(2)] : words;
  for (let i = 0; i < tokens.length; i++) {
    const hit = UNIT_TABLE[tokens[i]];
    if (hit) {
      const modifier = [...tokens.slice(0, i), ...tokens.slice(i + 1)]
        .filter((t) => t !== "of" && t !== "a" && t !== "the")
        .join(" ")
        .trim();
      return { ...hit, modifier: modifier || undefined };
    }
  }
  return null;
}

/** How many tsp are in one unit — lets us convert inside the volume family. */
const TSP_PER: Partial<Record<Unit, number>> = { tsp: 1, tbsp: 3, cup: 48 };

/** Convert a quantity between units when they're in the same family. */
export function convertUnits(qty: number, from: Unit, to: Unit): number | null {
  if (from === to) return qty;
  const a = TSP_PER[from];
  const b = TSP_PER[to];
  if (a && b) return (qty * a) / b;
  return null; // oz ↔ cup needs a density; "each" converts to nothing.
}

// ---- Header mapping ----

type Role =
  | "food" | "quantity" | "unit" | "servingSize" | "servingUnit"
  | "calPerUnit" | "totalCalories" | "protein" | "carbs" | "fat" | "servings";

/** Match a header cell to a column role. Order matters: the most specific
 *  patterns ("serving size unit" also contains "unit") are tested first. */
function headerRole(raw: string): Role | null {
  const h = raw.toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();
  if (!h) return null;
  const has = (...w: string[]) => w.every((x) => h.includes(x));
  if (has("serving") && (has("unit") || has("measure"))) return "servingUnit";
  if (has("serving") && (has("size") || has("num") || has("qty") || has("amount"))) return "servingSize";
  if (has("total") && (has("cal") || has("kcal") || has("energy"))) return "totalCalories";
  if (has("cal") || has("kcal") || has("energy")) {
    return has("per") || h.includes("/") || has("each") || has("unit") ? "calPerUnit" : "totalCalories";
  }
  if (has("protein")) return "protein";
  if (has("carb")) return "carbs";
  if (has("fat")) return "fat";
  if (has("serving") || has("yield") || has("makes")) return "servings";
  if (/\b(qty|quantity|amount|amt|how much)\b/.test(h)) return "quantity";
  if (/\b(unit|units|uom|measure|measurement)\b/.test(h)) return "unit";
  if (/\b(food|foods|item|items|ingredient|ingredients|name|product|description)\b/.test(h)) return "food";
  return null;
}

// ---- Splitting text into a grid ----

type Delim = "\t" | "|" | "," | "spaces";

function splitLine(line: string, delim: Delim): string[] {
  if (delim === "spaces") return line.trim().split(/\s{2}/).map((c) => c.trim());
  if (delim === "|") return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  if (delim === ",") return splitCsv(line);
  return line.split("\t").map((c) => c.trim());
}

/** Comma split that respects "quoted, cells" (spreadsheet CSV export). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** A markdown table's "|---|---|" rule row. */
const isRuleRow = (line: string) => /^[\s|:+-]+$/.test(line) && /[-]/.test(line);

function mapHeader(cells: string[]): Partial<Record<Role, number>> | null {
  const map: Partial<Record<Role, number>> = {};
  let hits = 0;
  cells.forEach((cell, i) => {
    const role = headerRole(cell);
    if (role && map[role] === undefined) { map[role] = i; hits++; }
  });
  // A header must name the food column plus at least one more, and hold no data.
  if (map.food === undefined || hits < 2) return null;
  if (cells.some((c) => c && numericCell(c) !== null)) return null;
  return map;
}

/**
 * Find the delimiter and the grid. Tab/pipe are strong enough signals on their
 * own; comma and column-aligned spaces need a recognizable header row so we
 * don't shred prose like "2 eggs, beaten" into columns.
 */
function toGrid(lines: string[]): { grid: string[][]; header: Partial<Record<Role, number>> | null; before: string[] } | null {
  for (const delim of ["\t", "|", ",", "spaces"] as Delim[]) {
    const split = lines.map((l) => splitLine(l, delim));
    const wide = split.filter((c) => c.filter(Boolean).length >= 2);
    if (wide.length < 2) continue;

    let headerAt = -1;
    let header: Partial<Record<Role, number>> | null = null;
    for (let i = 0; i < Math.min(split.length, 8); i++) {
      const m = mapHeader(split[i]);
      if (m) { headerAt = i; header = m; break; }
    }
    const strong = delim === "\t" || delim === "|";
    if (!header && !strong) continue;

    const body = split
      .slice(headerAt + 1)
      .filter((cells, i) => cells.filter(Boolean).length >= 2 && !isRuleRow(lines[headerAt + 1 + i]));
    if (body.length < 1) continue;
    return { grid: body, header, before: lines.slice(0, Math.max(headerAt, 0)) };
  }
  return null;
}

// ---- Summary rows ----

const SUMMARY_RE = /^(grand\s+)?(total|totals|sum|subtotal|per[\s-]*serving|serving size|servings?|yield|makes|notes?)\b/i;
const PER_SERVING_RE = /^per[\s-]*serving|^serving\b/i;

/** "PER SERVING (6 servings)", "Servings: 6", "Makes 4" → 6 / 6 / 4. */
function servingsIn(text: string): number | undefined {
  const m =
    text.match(/(\d+(?:\.\d+)?)\s*servings?\b/i) ||
    text.match(/\b(?:servings?|yield|makes|serves)\b\D{0,4}(\d+(?:\.\d+)?)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Rightmost number in a row — where summary rows park their calorie figure. */
function lastNumber(cells: string[]): number | undefined {
  for (let i = cells.length - 1; i >= 0; i--) {
    const n = numericCell(cells[i]);
    if (n !== null) return n;
  }
  return undefined;
}

// ---- Headerless column inference ----

/** For a tab/pipe grid with no header: col 0 is the food, the first numeric
 *  column is the quantity, a unit word may follow it, and a trailing numeric
 *  column is calories. */
function inferHeader(grid: string[][]): Partial<Record<Role, number>> {
  const map: Partial<Record<Role, number>> = { food: 0 };
  const row = grid.find((r) => r.filter(Boolean).length >= 2 && !SUMMARY_RE.test(r[0] ?? "")) ?? grid[0];
  for (let i = 1; i < row.length; i++) {
    if (map.quantity === undefined && numericCell(row[i]) !== null) { map.quantity = i; continue; }
    if (map.quantity !== undefined && map.unit === undefined && parseUnitCell(row[i])) { map.unit = i; continue; }
    if (map.quantity !== undefined && numericCell(row[i]) !== null) map.totalCalories = i; // keep the last one
  }
  return map;
}

// ---- Calorie math ----

/**
 * A "per unit" nutrition column is really "per serving size": 40 cal per 0.5 cup.
 * Scale it to one app unit of the ingredient, converting within the volume
 * family when the serving is written in a different unit (tbsp vs cup).
 *
 * `basis` is the unit that column is measured in — the serving-size unit when
 * the table has one, otherwise the row's own unit (so "800 cal per unit" on a
 * row measured in lb becomes 50 cal per oz).
 */
function perAppUnit(
  perServing: number,
  servingSize: number,
  basis: ParsedUnit | null,
  unit: Unit,
): number | undefined {
  const size = servingSize > 0 ? servingSize : 1;
  const inBasisUnits = size * (basis?.factor ?? 1);
  if (inBasisUnits <= 0) return undefined;
  const asIngredientUnits = basis ? convertUnits(inBasisUnits, basis.unit, unit) : inBasisUnits;
  if (asIngredientUnits === null || asIngredientUnits <= 0) return undefined;
  return perServing / asIngredientUnits;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- The parser ----

/**
 * Parse pasted tabular text into food rows. Returns null when the text isn't a
 * table, so callers can fall back to line-by-line parsing.
 */
export function parseFoodTable(text: string): FoodTable | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const found = toGrid(lines);
  if (!found) return null;

  const header = found.header ?? inferHeader(found.grid);
  if (header.food === undefined) return null;

  const cellAt = (cells: string[], role: Role | undefined) =>
    role !== undefined && header[role] !== undefined ? (cells[header[role]!] ?? "").trim() : "";

  const table: FoodTable = { rows: [] };

  for (const cells of found.grid) {
    const label = (cells[header.food!] ?? cells.find(Boolean) ?? "").trim();
    if (!label) continue;

    // Summary rows aren't ingredients, but they carry servings + totals.
    if (SUMMARY_RE.test(label)) {
      const line = cells.join(" ");
      const cal = lastNumber(cells);
      if (PER_SERVING_RE.test(label)) {
        if (cal !== undefined) table.declaredPerServingCalories = cal;
      } else if (/^(grand\s+)?(total|totals|sum|subtotal)\b/i.test(label)) {
        if (cal !== undefined) table.declaredTotalCalories = cal;
      }
      table.servings = table.servings ?? servingsIn(line);
      continue;
    }

    // Quantity + unit. The unit often rides in the quantity cell ("8 cups dry")
    // when there's no unit column at all.
    const qtyCell = cellAt(cells, "quantity");
    const unitCell = cellAt(cells, "unit");
    let written = parseQuantity(qtyCell);
    let parsedUnit = parseUnitCell(unitCell);
    if (written === null || !parsedUnit) {
      const combined = qtyCell.match(/^\s*([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞-]+)\s*(.*)$/);
      if (combined) {
        written = written ?? parseQuantity(combined[1]);
        parsedUnit = parsedUnit ?? parseUnitCell(combined[2]);
      }
    }
    const servingUnit = parseUnitCell(cellAt(cells, "servingUnit"));
    const unit: Unit = parsedUnit?.unit ?? servingUnit?.unit ?? "each";
    const quantity = Math.max(0, (written ?? 0) * (parsedUnit?.factor ?? 1));

    const servingSize = numericCell(cellAt(cells, "servingSize")) ?? 1;
    const declaredTotal = numericCell(cellAt(cells, "totalCalories")) ?? undefined;
    const perUnitCol = numericCell(cellAt(cells, "calPerUnit")) ?? undefined;

    const basis = servingUnit ?? parsedUnit;
    let caloriesPerUnit =
      perUnitCol !== undefined ? perAppUnit(perUnitCol, servingSize, basis, unit) : undefined;
    // No usable per-unit column (or units that can't be converted): fall back to
    // the row's own total ÷ quantity, which is unit-consistent by definition.
    if (caloriesPerUnit === undefined && declaredTotal !== undefined && quantity > 0) {
      caloriesPerUnit = declaredTotal / quantity;
    }
    const totalCalories =
      declaredTotal ?? (caloriesPerUnit !== undefined ? caloriesPerUnit * quantity : undefined);

    const macro = (role: Role) => {
      const v = numericCell(cellAt(cells, role));
      if (v === null) return undefined;
      const per = perAppUnit(v, servingSize, basis, unit);
      return per === undefined ? undefined : round2(per);
    };

    table.rows.push({
      food: label.replace(/\s+/g, " ").trim(),
      quantity: round2(quantity),
      unit,
      note: parsedUnit?.modifier,
      caloriesPerUnit: caloriesPerUnit === undefined ? undefined : round2(caloriesPerUnit),
      totalCalories: totalCalories === undefined ? undefined : round2(totalCalories),
      protein: macro("protein"),
      carbs: macro("carbs"),
      fat: macro("fat")
    });
  }

  if (!table.rows.length) return null;

  // A short, quantity-free line above the table is the dish name.
  const title = found.before.map((l) => l.trim()).filter(Boolean).pop();
  if (title && title.split(/\s+/).length <= 8 && !SUMMARY_RE.test(title)) table.title = title;
  // "Serves 8" / "Servings: 4" can sit above, below, or beside the table.
  for (const line of lines) table.servings = table.servings ?? servingsIn(line);

  // Last resort: derive servings from the two summary figures (2974 / 496 ≈ 6).
  if (!table.servings && table.declaredTotalCalories && table.declaredPerServingCalories) {
    const n = Math.round(table.declaredTotalCalories / table.declaredPerServingCalories);
    if (n > 0 && n <= 50) table.servings = n;
  }
  return table;
}
