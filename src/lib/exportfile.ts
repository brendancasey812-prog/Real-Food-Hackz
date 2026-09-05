// Getting the plan out of the app: a week of meals, or the list you shop from.
//
// Everything here is a pure string builder over data the app already holds, so
// an export is exactly what the screen says — no server, no round trip. The
// browser saves the result as a file, or it goes to the clipboard for pasting
// into a message.

import { format } from "date-fns";
import type { Food, PlannedMeal, Recipe } from "./types";
import { FOOD_CATEGORY_LABEL } from "./foodcat";
import { fmtQty, pluralUnit } from "./units";
import { fmtMoney } from "./cost";
import { MEAL_LABEL } from "./week";
import { MEAL_TIME } from "./mealtime";

const LOCATION_LABEL = { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" } as const;

/** One line of a grocery export. */
export interface GroceryLine {
  food: Food;
  buy: number;
  cost: number | null;
}

/** One planned meal, resolved against its recipe. */
export interface PlanLine {
  meal: PlannedMeal;
  recipe: Recipe;
  calories: number;
  cost: number | null;
}

const day = (iso: string) => new Date(`${iso}T00:00:00`);

// ---- Grocery list ----

/** A checklist to read in the shop: aisles under the room they end up in. */
export function groceryText(lines: GroceryLine[], weekOf: Date): string {
  const out: string[] = [
    "GROCERY LIST",
    `Week of ${format(weekOf, "MMM d, yyyy")}`,
    "",
  ];
  let total = 0;
  let unpriced = 0;

  for (const loc of ["fridge", "freezer", "pantry"] as const) {
    const here = lines.filter((l) => l.food.location === loc);
    if (here.length === 0) continue;
    out.push(LOCATION_LABEL[loc].toUpperCase());
    const cats = new Set(here.map((l) => l.food.category));
    for (const cat of cats) {
      out.push(`  ${FOOD_CATEGORY_LABEL[cat]}`);
      for (const l of here
        .filter((x) => x.food.category === cat)
        .sort((a, b) => a.food.name.localeCompare(b.food.name))) {
        const ask = Math.ceil(l.buy * 4) / 4;
        const money = l.cost == null ? "" : `  ${fmtMoney(l.cost)}`;
        if (l.cost == null) unpriced++; else total += l.cost;
        out.push(`    [ ] ${fmtQty(ask)} ${pluralUnit(ask, l.food.unit)}  ${l.food.name}${money}`);
      }
    }
    out.push("");
  }

  out.push(
    `${lines.length} items · ${fmtMoney(total)}${unpriced > 0 ? ` (+${unpriced} unpriced)` : ""}`,
  );
  return out.join("\n");
}

/** The same list as a spreadsheet. */
export function groceryCsv(lines: GroceryLine[]): string {
  const rows = [["Item", "Quantity", "Unit", "Food type", "Stored in", "Cost", "Calories"]];
  for (const l of lines.sort((a, b) => a.food.name.localeCompare(b.food.name))) {
    const ask = Math.ceil(l.buy * 4) / 4;
    rows.push([
      l.food.name,
      String(ask),
      l.food.unit,
      FOOD_CATEGORY_LABEL[l.food.category],
      LOCATION_LABEL[l.food.location],
      l.cost == null ? "" : l.cost.toFixed(2),
      String(Math.round(l.buy * l.food.caloriesPerUnit)),
    ]);
  }
  return toCsv(rows);
}

// ---- Weekly meals ----

/** The week as you'd write it on a fridge whiteboard. */
export function planText(lines: PlanLine[], days: Date[]): string {
  const out: string[] = [
    "MEAL PLAN",
    `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`,
    "",
  ];
  let weekCal = 0;
  let weekCost = 0;

  for (const d of days) {
    const iso = format(d, "yyyy-MM-dd");
    const here = lines.filter((l) => l.meal.date === iso);
    out.push(format(d, "EEEE, MMM d").toUpperCase());
    if (here.length === 0) {
      out.push("  nothing planned");
    } else {
      const dayCal = here.reduce((s, l) => s + l.calories, 0);
      weekCal += dayCal;
      for (const l of here) {
        const money = l.cost == null ? "" : `  ${fmtMoney(l.cost)}`;
        if (l.cost != null) weekCost += l.cost;
        out.push(
          `  ${MEAL_LABEL[l.meal.mealType].padEnd(10)} ${l.recipe.name}` +
            ` (${l.meal.servings} serving${l.meal.servings === 1 ? "" : "s"}, ${l.calories.toLocaleString()} cal)${money}`,
        );
      }
      out.push(`  ${dayCal.toLocaleString()} cal for the day`);
    }
    out.push("");
  }

  out.push(`Week total: ${weekCal.toLocaleString()} cal · ${fmtMoney(weekCost)}`);
  return out.join("\n");
}

/** The week as a spreadsheet, one row per meal. */
export function planCsv(lines: PlanLine[]): string {
  const rows = [["Date", "Day", "Meal", "Recipe", "Servings", "Calories", "Cost"]];
  for (const l of [...lines].sort((a, b) => a.meal.date.localeCompare(b.meal.date))) {
    rows.push([
      l.meal.date,
      format(day(l.meal.date), "EEEE"),
      MEAL_LABEL[l.meal.mealType],
      l.recipe.name,
      String(l.meal.servings),
      String(l.calories),
      l.cost == null ? "" : l.cost.toFixed(2),
    ]);
  }
  return toCsv(rows);
}

/**
 * The week as calendar events, so the plan can live in the calendar you
 * already look at. Meals land on their usual hour unless they were dragged
 * somewhere else, in which case that placement is what gets exported.
 */
export function planIcs(lines: PlanLine[]): string {
  // DTSTAMP is a real instant, so it is UTC. The meals are not: dinner is at 7
  // wherever you are, so they go out as iCalendar "floating" local times —
  // no Z — and stay at 7 if the calendar is read in another timezone.
  const utc = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const floating = (iso: string, hours: number) => {
    const [y, m, dd] = iso.split("-");
    return `${y}${m}${dd}T${pad(Math.floor(hours))}${pad(Math.round((hours % 1) * 60))}00`;
  };

  const now = utc(new Date());
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Real Food Hackz//Meal Plan//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const l of lines) {
    const slot = MEAL_TIME[l.meal.mealType];
    const startH = l.meal.start ?? slot.start;
    const endH = l.meal.end ?? (l.meal.start != null ? l.meal.start + 1 : slot.end);
    const detail = [
      `${l.meal.servings} serving${l.meal.servings === 1 ? "" : "s"}`,
      `${l.calories.toLocaleString()} cal`,
      l.cost == null ? null : fmtMoney(l.cost),
    ].filter(Boolean).join(" · ");
    out.push(
      "BEGIN:VEVENT",
      `UID:${l.meal.id}@realfoodhackz`,
      `DTSTAMP:${now}`,
      `DTSTART:${floating(l.meal.date, startH)}`,
      `DTEND:${floating(l.meal.date, endH)}`,
      `SUMMARY:${ics(`${MEAL_LABEL[l.meal.mealType]}: ${l.recipe.name}`)}`,
      `DESCRIPTION:${ics(detail)}`,
      "END:VEVENT",
    );
  }

  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

// ---- Plumbing ----

const pad = (n: number) => String(n).padStart(2, "0");

/** Escape the characters iCalendar treats as structure. */
const ics = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** Quote a cell only when it needs it, so the file stays readable. */
function toCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    )
    .join("\n");
}

/** Hand the file to the browser. */
export function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a beat to start before the blob goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Clipboard, with a fallback for browsers that refuse the async API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** A filename that sorts by date and says what it is. */
export function exportName(kind: string, on: Date, ext: string): string {
  return `real-food-hackz-${kind}-${format(on, "yyyy-MM-dd")}.${ext}`;
}
