# 🥗 PantryPlan

A meal-planning web app + mobile-format companion where **everything stays in sync from one source of truth: your food quantities.**

Add a recipe → schedule it on the calendar → and the dashboard calories, grocery
list, and fridge/pantry levels all update together.

## Tabs

| Tab | What it does |
| --- | --- |
| **Dashboard** | Weekly calorie tracker vs. your daily goal, plus live stats pulled from every other tab. |
| **Cookbook** | Browse recipes (calories auto-calculated from ingredients) and add your own. |
| **Planner** | Google-Calendar-style weekly grid — drop recipes onto breakfast/lunch/dinner/snack slots. |
| **Groceries** | Auto-built list = what the week's plan needs − what's already in your kitchen. |
| **Kitchen** | Visual fridge, freezer & pantry with live stock bars showing how much the week's plan will use. |

## How it stays in sync

```
RECIPES ──▶ PLANNER ──▶ DASHBOARD (calories vs goal)
                   ├──▶ GROCERIES (need − have)
                   └──▶ KITCHEN   (stock depletion)
```

One shared store ([`src/lib/store.ts`](src/lib/store.ts)) holds foods, inventory,
recipes, the plan, and goals. Every tab is a live, reactive view of it.

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
