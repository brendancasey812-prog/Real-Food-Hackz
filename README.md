# 🥗 PantryPlan

A meal-planning web app + mobile-format companion where **everything stays in sync from one source of truth: your food quantities.**

Add a recipe → schedule it on the calendar → and the dashboard calories, grocery
list, and fridge/pantry levels all update together.

## Tabs

| Tab | What it does |
| --- | --- |
| **Dashboard** | Weekly calorie tracker vs. your daily goal, plus live stats pulled from every other tab. |
| **Cookbook** | Browse recipes (calories auto-calculated from ingredients) and add your own. |
| **Meal Plan** | Google-Calendar-style weekly grid — drop recipes onto breakfast/lunch/dinner/snack slots, and clear a day, week, month, year, hand-picked days, or any date range. |
| **Groceries** | Auto-built list = what the week's plan needs − what's already in your kitchen. |
| **Kitchen** | A fridge you can open — glass shelves and crisper drawers of food icons, each showing its amount. Also a List view with stock bars. |
| **Costs** | The cost repository — every ingredient priced per its own unit, rolling up to per-recipe and per-week spend. |
| **Stores** | Map of the grocery stores near you. Pick one and the whole app re-prices against it. |

## The fridge

The Kitchen opens on a steel cabinet with glass shelves, a door bin and crisper
drawers ([`src/components/Fridge.tsx`](src/components/Fridge.tsx)). Tap a
section to slide it open; inside, every food is an app icon — the food on top,
its name and **quantity + unit** underneath, and a badge with the amount on
hand. Anything at zero is dimmed. Shelves follow a real fridge: produce in the
crispers, condiments in the door, everything else on a shelf.

Tapping a food opens a sheet to set how much you have, with its calories and
macros alongside.

### Cook from what you have

Flip **Pick ingredients** on and the icons become selectable — out-of-stock
foods are greyed out, because you can't cook with them. Choose what you want,
tap **Build recipe**, and a sheet lets you set an amount for each one (capped at
what's actually in the fridge), name it, pick a meal slot and servings, and
watch the calories total up. Saving drops it straight into the Cookbook, where
it costs and plans itself like any other recipe.

The old dense view is still there under the **List** toggle — sliders, per-unit
nutrition editing, and bulk delete.

## Light & dark

The whole app paints from one set of CSS variables
([`src/app/globals.css`](src/app/globals.css)), so the theme is a single class
swap on `<html>` — no page hardcodes a color. Pick **Light**, **Dark** or
**System** under the gear (top-right of every tab, and in the mobile header).
The choice is saved per device, and an inline script in the layout applies it
before first paint so there's no flash.

Colors carry meaning rather than decoration:

| Role | Reads as |
| --- | --- |
| App accent | herb green — nav, buttons, on-target bars, spend |
| Protein / Carbs / Fat | seared red / wheat gold / olive oil |
| Calories | warm ember |
| Weekly bars | cool blue (under) · green (on target) · beet (over) |
| Meal slots | sunrise · sea · herb · night · beet |

## How it stays in sync

```
RECIPES ──▶ MEAL PLAN ─▶ DASHBOARD (calories vs goal, food spend)
                   ├──▶ GROCERIES (need − have, basket cost)
                   └──▶ KITCHEN   (stock depletion)

STORES ──▶ (selected store) ──▶ COSTS ──▶ every dollar figure above
```

One shared store ([`src/lib/store.ts`](src/lib/store.ts)) holds foods, inventory,
recipes, the plan, and goals. Every tab is a live, reactive view of it.

## Cost tracking

Money works exactly like calories: priced at the **individual food-unit level**
and rolled up everywhere from that one number.

- Every **food** can carry a `pricePerUnit` — the cost of one of its own units
  (chicken per `oz`, milk per `cup`, olive oil per `tbsp`), so an ingredient line
  costs `quantity x pricePerUnit`, mirroring `ingredientCalories` exactly.
- A **recipe's** cost is *derived*, never hand-entered, and sub-recipe components
  are expanded down to their underlying foods just like calories are.
- The **Costs** tab is the repository: search/filter every ingredient, type a
  price, and watch the week's spend move.
- The **Groceries** list totals what the basket will cost; the **Dashboard**
  shows this week / today / average-per-day spend.

### Prices are per store

Prices live against a store, with a **base price** row as the fallback:

```
price at selected store  →  else base price  →  else "unpriced"
```

Pick a store in the **Stores** tab and every dollar figure in the app re-costs
against it. A store with no price of its own for a food quietly falls back to
your base price, so you only have to fill in what actually differs.

**Unpriced ingredients are never silently treated as $0.** Any total that is
missing a price says so (`+3 unpriced`), because a confident dollar figure that
is quietly missing half its ingredients is worse than no figure at all.

Helpers live in [`src/lib/cost.ts`](src/lib/cost.ts) (`priceFor`,
`ingredientCost`, `recipeTotalCost`, `recipeCostPerServing`, `plannedCost`).
Run the cost math tests with:

```bash
npm run test:cost
```

## Store locator

The **Stores** tab maps where you shop, using two free, key-less services called
straight from the browser:

- **[Nominatim](https://nominatim.openstreetmap.org/)** turns a typed
  `City, ST` or ZIP into coordinates.
- **[Overpass](https://overpass-api.de/)** finds the real supermarkets within
  8 miles of that point.

Map tiles are OpenStreetMap via [Leaflet](https://leafletjs.com/). All three are
best-effort: if any is unreachable, the tab says so and you can still add a
store by hand and price it. Nothing about costing depends on the network.

## Nutrition & calorie tracking

Every food carries **calories + protein / carbs / fat per unit**, and it all rolls
up live: recipes show per-serving macros, and the **Dashboard** shows a weekly
calorie **bar chart with your daily-goal line** plus **Today**'s protein/carbs/fat
vs target. The default plan is built for a **6'2", 200 lb, 25-year-old male at
~2,900 cal/day** (180g protein / 330g carbs / 90g fat) and the full 7-day meal
plan is loaded across the whole month — viewable in the planner's **Month** view.

Calories are tracked at the **individual food-unit level** and roll up everywhere:

- Every **food** stores `caloriesPerUnit` — calories in one US unit of it
  (per each / cup / tbsp / tsp / oz).
- A **recipe's** calories are *derived*, never hand-entered:
  `ingredientCalories = quantity × caloriesPerUnit`, summed for the recipe total,
  divided by servings for the per-serving figure. Both the per-ingredient and
  the total/per-serving numbers are shown on each recipe card and live in the
  add-recipe form as you build it.
- The **Kitchen** shows each food's `cal / unit` and its total calories on hand.
- The **Groceries** list totals the calories you're about to buy.
- The **Dashboard** rolls planned meals into a weekly calorie tracker vs. your
  daily goal.

Helper functions live in [`src/lib/store.ts`](src/lib/store.ts)
(`ingredientCalories`, `recipeTotalCalories`, `recipeCaloriesPerServing`) and
US units in [`src/lib/units.ts`](src/lib/units.ts).

### Units

All quantities use **US measuring units** — `each`, `cup`, `tbsp`, `tsp`, `oz` —
picked per food for the most rational way to cook with it (eggs by *each*, milk
by *cup*, chicken by *oz*, olive oil by *tbsp*, …).

### Adding items

- **Cookbook → Add recipe** — new ingredients you type in are created as foods
  and automatically appear in the Kitchen, Pantry, groceries, and calorie math.
- **Kitchen → Add food** and **Groceries → Add item** — the top-right buttons add
  a food (name, emoji, unit, calories/unit, location, quantity) to the catalog.

## Receipt scanner (AI)

The Kitchen tab has a **Scan receipt** button. Take/upload a photo of a grocery
receipt and Claude's vision model reads it, classifies each item
(Protein / Fruit / Veggie / Pantry), normalizes names and variants, converts to
US units, and estimates package sizes when the receipt doesn't print them. You
**review and edit** the parsed items in a table (fix a category, delete a
non-food row) before anything is saved. On confirm, items are **merged into your
Kitchen** by normalized name — quantities are unit-converted and summed, the
variant is appended to a `notes` field, and every purchase is written to a
history log for traceability. Unmatched items are added as new foods.

- Implementation: [`src/lib/receipt.ts`](src/lib/receipt.ts) (system prompt,
  `scanReceipt` via the Anthropic SDK, `demoScan`, merge helpers) and
  [`src/components/ScanReceiptModal.tsx`](src/components/ScanReceiptModal.tsx).
- **API key:** because the site is static (no backend), real scanning uses
  **your own Anthropic API key**, pasted into the modal's Settings and stored
  only in your browser (`localStorage`), sent directly to Anthropic. A built-in
  **sample receipt** lets you try the whole flow with no key.
- Model: `claude-opus-5` (vision). Change it in `src/lib/receipt.ts`.

## Recipe & food-table import (Cookbook → Add recipe)

**Scan recipe** reads a photo of a recipe card or a printed nutrition table;
**Paste text** takes either an ingredient list ("6 oz firm tofu", one per line)
or a whole **food table copied out of a spreadsheet or doc**:

```
Food                     Quantity  Unit       Serving Size  Serving Unit  Calories per Unit  Total Calories
Farfalle Pasta De Cecco  8         cups dry   1             cup dry       200                1600
Ground Beef 80/20        16        oz         4             oz            280                1120
TOTAL                                                                                        2974
PER SERVING (6 servings)                                                                     496
```

Tables are read as tables, not as sentences
([`src/lib/foodtable.ts`](src/lib/foodtable.ts)):

- **Any delimiter** — tabs, commas (quoted cells included), markdown pipes, or
  column-aligned spacing.
- **Columns by header**, not position — `Food`/`Item`/`Ingredient`,
  `Qty`/`Amount`, `Unit`/`Measure`, serving size + serving unit, calories per
  unit, total calories, and protein/carbs/fat when present.
- **Units with qualifiers** — "cups dry", "cup chopped", "tsp minced" keep the
  base unit and park the qualifier in the food's notes. lb, g, kg, ml, L,
  pints, quarts, cloves, slices and cans are converted to the app's units.
- **Serving-size calorie math** — a "Calories per Unit" column is calories per
  *serving size*, so 40 cal per ½ cup becomes 80 cal/cup and 280 cal per 4 oz
  becomes 70 cal/oz. When the serving unit can't be converted (oz vs. cup), the
  row falls back to `Total Calories ÷ quantity`.
- **Summary rows** — `TOTAL`, `SUBTOTAL` and `PER SERVING (6 servings)` never
  become ingredients; they set the recipe's servings and are shown back as a
  cross-check ("Matches the 2,974 cal total on your list", or an amber warning
  when the per-item math disagrees by more than 2%).
- **Calories land on the foods** — imported calories/macros are saved on new
  foods and fill in blanks on existing ones, so the Cookbook, Dashboard and
  Kitchen totals are right immediately instead of starting at zero.
- Quantities are converted into the unit a food is already stocked in, and the
  review screen says so when a unit can't be converted (kitchen garlic in
  `each` vs. a recipe's `tsp`) rather than silently reinterpreting it.

Pasting works **with no API key** — the table parser runs locally, and it also
catches an API failure so a structured paste still gets through. With a key,
Claude handles messier input (prose recipes, photos) using the same rules.

## Tech

- **Next.js (App Router) + React + TypeScript**
- **Tailwind CSS** for the responsive UI — sidebar on desktop (website), bottom tab bar on phones (app)
- **Zustand** for shared state, persisted to the browser (no login needed yet)

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Data persists in your browser. There's a `resetToSeed()` action in the store to
restore the sample kitchen.

## Roadmap ideas

- User accounts + cloud sync (multi-device)
- Auto-deduct inventory when a meal is marked "cooked"
- Nutrition beyond calories (protein/carbs/fat)
- Barcode scanning to stock the pantry
- Recipe import from a URL
