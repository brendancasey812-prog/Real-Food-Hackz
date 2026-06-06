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
