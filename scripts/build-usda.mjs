#!/usr/bin/env node
/**
 * Distil a USDA FoodData Central "Foundation Foods" export into the compact
 * reference table the app ships.
 *
 *   node scripts/build-usda.mjs ~/Downloads/FoodData_Central_foundation_food_json_*.json
 *
 * The source download is ~6.5 MB of every nutrient FDC measures; the app only
 * needs calories, the three macros, and enough portion weights to turn "per
 * 100 g" into "per cup / per each". That lands around 50 KB, small enough to
 * bundle into a static export.
 *
 * Source: https://fdc.nal.usda.gov/download-datasets.html (public domain)
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "src/lib/usda-foods.json";

// FDC nutrient ids. Foundation foods state energy in one of three ways, so we
// try the plain figure first and fall back to the Atwater calculations.
const KCAL = 1008;
const KCAL_ATWATER_SPECIFIC = 2048;
const KCAL_ATWATER_GENERAL = 2047;
const PROTEIN = 1003;
const FAT = 1004;
const CARBS = 1005;

const G_PER_OZ = 28.3495;
const TBSP_PER_CUP = 16;
const TSP_PER_CUP = 48;
const ML_PER_CUP = 236.588;

/** Portion names that describe one whole item. */
const EACH_NAMES = new Set([
  "each", "piece", "fruit", "egg", "slice", "link", "fillet", "drumstick",
  "wedge", "roast", "breast", "thigh", "leaf", "clove", "ear", "stalk",
]);

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-usda.mjs <FoodData_Central_foundation_food_*.json>");
  process.exit(1);
}

const foods = JSON.parse(readFileSync(src, "utf8")).FoundationFoods ?? [];

/** Energy in kcal, whichever way this record happens to state it. */
const energyOf = (food) =>
  amountOf(food, KCAL, "kcal") ??
  amountOf(food, KCAL_ATWATER_SPECIFIC, "kcal") ??
  amountOf(food, KCAL_ATWATER_GENERAL, "kcal");

const amountOf = (food, id, unit) => {
  const hit = food.foodNutrients?.find(
    (n) => n.nutrient?.id === id && (!unit || n.nutrient?.unitName?.toLowerCase() === unit),
  );
  const v = Number(hit?.amount);
  return Number.isFinite(v) ? v : null;
};

/** Grams in one of `unit`, from whichever portion describes it best. */
function gramsPer(food, kind) {
  const portions = (food.foodPortions ?? []).filter((p) => Number(p.gramWeight) > 0 && Number(p.value) > 0);
  const per = (p) => Number(p.gramWeight) / Number(p.value);
  const named = (name) => portions.find((p) => p.measureUnit?.name?.toLowerCase() === name);

  if (kind === "cup") {
    // One volume portion unlocks all three volume units — they're the same family.
    const cup = named("cup");
    if (cup) return per(cup);
    const tbsp = named("tablespoon");
    if (tbsp) return per(tbsp) * TBSP_PER_CUP;
    const tsp = named("teaspoon");
    if (tsp) return per(tsp) * TSP_PER_CUP;
    const ml = named("milliliter");
    if (ml) return per(ml) * ML_PER_CUP;
    return null;
  }

  for (const p of portions) {
    const name = p.measureUnit?.name?.toLowerCase();
    if (name && EACH_NAMES.has(name)) return per(p);
  }
  return null;
}

const round = (v, places = 2) =>
  v == null ? null : Math.round(v * 10 ** places) / 10 ** places;

const entries = [];
for (const food of foods) {
  const kcal = energyOf(food);
  // A few records (pure salt, 0%-moisture research samples) carry no energy at
  // all; they are not foods anyone cooks with, so they are left out.
  if (kcal == null) continue;

  entries.push({
    n: food.description,
    c: food.foodCategory?.description ?? "",
    id: food.fdcId,
    // Per 100 g, as FDC publishes them.
    k: round(kcal, 1),
    p: round(amountOf(food, PROTEIN, "g") ?? 0, 2),
    cb: round(amountOf(food, CARBS, "g") ?? 0, 2),
    f: round(amountOf(food, FAT, "g") ?? 0, 2),
    // Grams in one cup / one item, where FDC gives a portion for it.
    gc: round(gramsPer(food, "cup"), 2),
    ge: round(gramsPer(food, "each"), 2),
  });
}

entries.sort((a, b) => a.n.localeCompare(b.n));

writeFileSync(
  OUT,
  JSON.stringify({ gPerOz: G_PER_OZ, foods: entries }) + "\n",
);

const withCup = entries.filter((e) => e.gc != null).length;
const withEach = entries.filter((e) => e.ge != null).length;
console.log(
  `${entries.length} foods → ${OUT}` +
    ` (${withCup} with a cup weight, ${withEach} with a per-item weight)`,
);
