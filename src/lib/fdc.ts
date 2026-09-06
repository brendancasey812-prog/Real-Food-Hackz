// Live USDA FoodData Central lookup — the rest of the repository.
//
// The app ships 323 Foundation Foods, which covers staples and misses the
// long tail: a receipt line for "romaine lettuce" or "kefir" finds nothing and
// the food lands with zero calories. FDC itself holds hundreds of thousands
// across Foundation, SR Legacy and Survey data, and its API answers browser
// requests directly with a free key.
//
// The key is the user's own, kept in their browser exactly like the Anthropic
// one. FDC keys are free, rate-limited per key, and read-only against public
// domain data, so a key in a static page costs its owner a rate limit and
// nothing else.

import type { Unit } from "./types";

const SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";

/** Where the user's FDC key lives. Matches how the Anthropic key is stored. */
export const FDC_KEY_STORE = "fdc_api_key";

export function fdcKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(FDC_KEY_STORE)?.trim() ?? "";
}

export function setFdcKey(key: string) {
  if (typeof window !== "undefined") localStorage.setItem(FDC_KEY_STORE, key.trim());
}

/** FDC nutrient numbers, in the ids the API returns. */
const KCAL = [1008, 2047, 2048];
const PROTEIN = 1003;
const CARBS = 1005;
const FAT = 1004;

const G_PER_OZ = 28.349523;
const TBSP_PER_CUP = 16;
const TSP_PER_CUP = 48;

interface RawNutrient {
  nutrientId?: number;
  value?: number;
}

interface RawPortion {
  gramWeight?: number;
  modifier?: string;
  measureUnit?: { name?: string };
  amount?: number;
}

interface RawFood {
  fdcId: number;
  description: string;
  dataType?: string;
  foodCategory?: string;
  foodNutrients?: RawNutrient[];
  foodMeasures?: RawPortion[];
  servingSize?: number;
  servingSizeUnit?: string;
}

/** One FDC record, reduced to what the app can use. */
export interface FdcResult {
  fdcId: number;
  description: string;
  dataType: string;
  /** Per 100 g. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Grams in one cup / one item, when FDC publishes a portion for it. */
  gramsPerCup: number | null;
  gramsEach: number | null;
}

export class FdcError extends Error {}

const nutrient = (f: RawFood, id: number) =>
  f.foodNutrients?.find((n) => n.nutrientId === id)?.value ?? 0;

const energy = (f: RawFood) => {
  for (const id of KCAL) {
    const v = f.foodNutrients?.find((n) => n.nutrientId === id)?.value;
    if (v) return v;
  }
  return 0;
};

/** Portion weights, read out of whatever shape FDC used for this record. */
function portions(f: RawFood): { cup: number | null; each: number | null } {
  let cup: number | null = null;
  let each: number | null = null;
  for (const p of f.foodMeasures ?? []) {
    const grams = p.gramWeight;
    if (!grams || grams <= 0) continue;
    const text = `${p.modifier ?? ""} ${p.measureUnit?.name ?? ""}`.toLowerCase();
    const amount = p.amount && p.amount > 0 ? p.amount : 1;
    if (cup == null && /\bcup\b/.test(text)) cup = grams / amount;
    if (each == null && /\b(each|item|piece|fruit|medium|whole)\b/.test(text)) {
      each = grams / amount;
    }
  }
  return { cup, each };
}

/**
 * Search FoodData Central. Foundation and SR Legacy first — they are the
 * analysed records with real portion weights; Branded entries are label data
 * for one product and make a poor reference for "an apple".
 */
export async function searchFdc(
  query: string,
  key: string,
  signal?: AbortSignal,
): Promise<FdcResult[]> {
  if (!key) throw new FdcError("Add your free FoodData Central key in Settings first.");
  const url =
    `${SEARCH}?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query)}` +
    `&dataType=${encodeURIComponent("Foundation,SR Legacy,Survey (FNDDS)")}` +
    `&pageSize=10&requireAllWords=false`;

  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    throw new FdcError("Couldn't reach FoodData Central. Check your connection and try again.");
  }
  if (res.status === 403) throw new FdcError("FoodData Central rejected that key.");
  if (res.status === 429) throw new FdcError("That key has hit its hourly limit. Try again shortly.");
  if (!res.ok) throw new FdcError(`FoodData Central returned an error (${res.status}).`);

  const json = (await res.json()) as { foods?: RawFood[] };
  return (json.foods ?? []).map((f): FdcResult => {
    const p = portions(f);
    return {
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType ?? "",
      calories: Math.round(energy(f)),
      protein: nutrient(f, PROTEIN),
      carbs: nutrient(f, CARBS),
      fat: nutrient(f, FAT),
      gramsPerCup: p.cup,
      gramsEach: p.each,
    };
  });
}

/** Grams in one of the app's units, for this record. */
export function fdcGramsPerUnit(r: FdcResult, unit: Unit): number | null {
  switch (unit) {
    case "oz": return G_PER_OZ;
    case "cup": return r.gramsPerCup;
    case "tbsp": return r.gramsPerCup == null ? null : r.gramsPerCup / TBSP_PER_CUP;
    case "tsp": return r.gramsPerCup == null ? null : r.gramsPerCup / TSP_PER_CUP;
    case "each": return r.gramsEach;
  }
}

/** The record's numbers scaled to one of the app's units. */
export function fdcPerUnit(
  r: FdcResult,
  unit: Unit,
): { caloriesPerUnit: number; protein: number; carbs: number; fat: number } | null {
  const grams = fdcGramsPerUnit(r, unit);
  if (grams == null || grams <= 0) return null;
  const scale = grams / 100;
  const g = (v: number) => Math.round(v * scale * 10) / 10;
  return {
    caloriesPerUnit: Math.round(r.calories * scale),
    protein: g(r.protein),
    carbs: g(r.carbs),
    fat: g(r.fat),
  };
}
