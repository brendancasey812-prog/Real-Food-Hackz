"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X, Flame, Menu, ChevronDown, Camera, PenLine, ClipboardList, Search } from "lucide-react";
import {
  useApp,
  recipeCaloriesPerServing,
  recipeTotalCalories,
  recipeTotalsPerServing,
  ingredientCalories,
  componentCalories,
  foodById,
  newId,
} from "@/lib/store";
import { UNITS, unitLabel, pluralUnit, fmtQty } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import { RecipeScanModal } from "@/components/RecipeScanModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { RecipeCardV2 } from "@/components/RecipeCardV2";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import type { Food, FoodCategory, Location, MealType, Recipe, RecipeComponent, Unit } from "@/lib/types";

export default function Cookbook() {
  const { recipes, foods, removeRecipe } = useApp();
  const [manualOpen, setManualOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [filterMenu, setFilterMenu] = useState(false);
  const [visible, setVisible] = useState<Set<MealType>>(new Set(MEAL_ORDER));
  const [collapsed, setCollapsed] = useState<Set<MealType>>(new Set());
  const [search, setSearch] = useState("");
  const [secFilter, setSecFilter] = useState("all");
  const [tab, setTab] = useState<"classic" | "v2">("classic");
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const q = search.trim().toLowerCase();

  const toggleMeal = (m: MealType) =>
    setVisible((s) => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m); else n.add(m);
      return n;
    });
  const toggleCollapsed = (m: MealType) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m); else n.add(m);
      return n;
    });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {/* Hamburger filter (top-left) */}
          <div className="relative">
            <button
              onClick={() => setFilterMenu((v) => !v)}
              className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
              aria-label="Filter sections"
            >
              <Menu size={18} />
            </button>
            {filterMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFilterMenu(false)} />
                <div className="absolute left-0 z-40 mt-2 w-48 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl">
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Show sections</div>
                  {MEAL_ORDER.map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/[0.05]">
                      <input type="checkbox" checked={visible.has(m)} onChange={() => toggleMeal(m)} className="accent-emerald-500" />
                      {MEAL_LABEL[m]}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cookbook</h1>
            <p className="mt-1 text-sm text-zinc-500">{recipes.length} recipes · calories from each ingredient</p>
          </div>
        </div>

        {/* Add recipe dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setAddMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110"
          >
            <Plus size={16} /> Add recipe <ChevronDown size={14} />
          </button>
          {addMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAddMenu(false)} />
              <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl">
                <button onClick={() => { setAddMenu(false); setScanOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10">
                  <Camera size={16} className="text-emerald-400" /> Scan recipe (camera)
                </button>
                <button onClick={() => { setAddMenu(false); setTextOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10">
                  <ClipboardList size={16} className="text-emerald-400" /> Paste text (AI)
                </button>
                <button onClick={() => { setAddMenu(false); setManualOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10">
                  <PenLine size={16} className="text-emerald-400" /> Manually enter
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Cookbook / Cookbook V2 */}
      <div className="mb-4 flex w-fit rounded-xl border border-white/10 bg-white/[0.03] p-0.5 text-sm">
        {([["classic", "Cookbook"], ["v2", "Cookbook V2"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${
              tab === k ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow shadow-emerald-950/40" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <SearchFilterBar
        query={search}
        onQuery={setSearch}
        placeholder="Search recipes…"
        value={secFilter}
        onValue={setSecFilter}
        options={[{ value: "all", label: "All sections" }, ...MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABEL[m] }))]}
      />

      {/* Grouped sections by meal */}
      <div className="space-y-8">
        {MEAL_ORDER.filter((m) => visible.has(m) && (secFilter === "all" || secFilter === m)).map((meal) => {
          const list = recipes.filter((r) => r.category === meal && (q ? r.name.toLowerCase().includes(q) : true));
          if (list.length === 0) return null;
          const isCollapsed = !q && collapsed.has(meal);
          return (
            <section key={meal}>
              <button
                onClick={() => toggleCollapsed(meal)}
                className="mb-3 flex w-full items-center gap-2 text-lg font-semibold"
                aria-expanded={!isCollapsed}
              >
                <ChevronDown size={18} className={`text-zinc-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                {MEAL_LABEL[meal]}
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-normal text-zinc-400">{list.length}</span>
              </button>
              {!isCollapsed && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((r) => (tab === "v2"
                    ? <RecipeCardV2 key={r.id} recipe={r} foods={foods} recipes={recipes} onOpen={() => setOpenRecipeId(r.id)} onEdit={() => setEditRecipe(r)} onRemove={() => removeRecipe(r.id)} />
                    : <RecipeCard key={r.id} recipe={r} foods={foods} recipes={recipes} onOpen={() => setOpenRecipeId(r.id)} onEdit={() => setEditRecipe(r)} onRemove={() => removeRecipe(r.id)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {recipes.filter((r) => visible.has(r.category) && (secFilter === "all" || secFilter === r.category) && (q ? r.name.toLowerCase().includes(q) : true)).length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">{q ? `No recipes match “${search}”.` : "No recipes in the selected sections."}</p>
        )}
      </div>

      {openRecipeId && (
        <RecipeDetailModal
          recipeId={openRecipeId}
          onClose={() => setOpenRecipeId(null)}
          onEdit={() => {
            const r = recipes.find((x) => x.id === openRecipeId);
            setOpenRecipeId(null);
            if (r) setEditRecipe(r);
          }}
          onRemove={() => removeRecipe(openRecipeId)}
        />
      )}

      {manualOpen && <AddRecipeModal onClose={() => setManualOpen(false)} />}
      {editRecipe && <AddRecipeModal recipe={editRecipe} onClose={() => setEditRecipe(null)} />}
      {scanOpen && <RecipeScanModal mode="photo" onClose={() => setScanOpen(false)} />}
      {textOpen && <RecipeScanModal mode="text" onClose={() => setTextOpen(false)} />}
    </div>
  );
}

function RecipeCard({ recipe: r, foods, recipes, onOpen, onEdit, onRemove }: { recipe: Recipe; foods: Food[]; recipes: Recipe[]; onOpen: () => void; onEdit: () => void; onRemove: () => void }) {
  const perServing = recipeCaloriesPerServing(r, foods, recipes);
  const total = recipeTotalCalories(r, foods, recipes);
  const m = recipeTotalsPerServing(r, foods, recipes);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div onClick={onOpen} className="flex cursor-pointer flex-col rounded-2xl card p-5 transition-colors hover:border-emerald-400/40">
      <div className="flex items-start justify-between">
        <span className="text-3xl">{r.emoji}</span>
        {/* Hamburger menu (top-right) */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenu((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200" aria-label="Recipe menu">
            <Menu size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-40 mt-1 w-36 rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl">
                <button onClick={() => { setMenu(false); onEdit(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-emerald-500/10">
                  <PenLine size={15} className="text-emerald-400" /> Edit
                </button>
                <button onClick={() => { setMenu(false); setConfirming(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10">
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-2 font-semibold">{r.name}</h3>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/40 px-2.5 py-1 text-xs font-semibold text-rose-300">
          <Flame size={12} /> {perServing} cal / serving
        </span>
        <span className="text-xs text-zinc-400">{total} total · {r.servings} servings</span>
      </div>
      <div className="mt-2 flex gap-1.5 text-[11px]">
        <span className="rounded-md bg-rose-950/40 px-2 py-0.5 font-medium text-rose-300">P {m.protein}g</span>
        <span className="rounded-md bg-amber-950/40 px-2 py-0.5 font-medium text-amber-300">C {m.carbs}g</span>
        <span className="rounded-md bg-sky-950/40 px-2 py-0.5 font-medium text-sky-300">F {m.fat}g</span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-zinc-400">
        {(r.components ?? []).map((c) => {
          const sub = recipes.find((x) => x.id === c.recipeId);
          if (!sub) return null;
          return (
            <li key={`c-${c.recipeId}`} className="flex justify-between gap-2">
              <span className="truncate font-medium text-emerald-300">{sub.emoji} {sub.name}</span>
              <span className="shrink-0 text-zinc-400">
                {fmtQty(c.servings)} serv ·{" "}
                <span className="text-rose-400/80">{componentCalories(c, foods, recipes)} cal</span>
              </span>
            </li>
          );
        })}
        {r.ingredients.map((ing) => {
          const f = foodById(foods, ing.foodId);
          return (
            <li key={ing.foodId} className="flex justify-between gap-2">
              <span className="truncate">{f?.emoji} {f?.name ?? ing.foodId}</span>
              <span className="shrink-0 text-zinc-400">
                {fmtQty(ing.quantity)} {f ? pluralUnit(ing.quantity, f.unit) : ""} ·{" "}
                <span className="text-rose-400/80">{ingredientCalories(ing, foods)} cal</span>
              </span>
            </li>
          );
        })}
      </ul>

      {confirming && (
        <ConfirmDialog
          title="Delete recipe?"
          message={`“${r.name}” will be permanently removed from your cookbook and any calendar days it’s planned on. This can’t be undone.`}
          confirmLabel="Delete recipe"
          onConfirm={() => { setConfirming(false); onRemove(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

// ---- Collapsible, categorized ingredient picker ----

const NEW = "__new__";

function IngredientPicker({ foods, value, onChange }: { foods: Food[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<FoodCategory>>(new Set());
  const [query, setQuery] = useState("");
  const selected = value === NEW ? null : foods.find((f) => f.id === value);
  const toggle = (k: FoodCategory) => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const close = () => { setOpen(false); setQuery(""); };
  const pick = (id: string) => { onChange(id); close(); };

  const q = query.trim().toLowerCase();
  const matches = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : [];

  return (
    <div className="relative min-w-0 flex-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-1 rounded-lg field px-2 py-1.5 text-left text-sm">
        <span className="truncate">{value === NEW ? "➕ New ingredient…" : selected ? `${selected.emoji} ${selected.name}` : "Select ingredient…"}</span>
        <ChevronDown size={14} className="shrink-0 text-zinc-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute z-50 mt-1 flex max-h-80 w-full min-w-[220px] flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
            {/* Search box */}
            <div className="relative border-b border-white/[0.07] p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients…"
                className="w-full rounded-lg field py-1.5 pl-8 pr-2 text-sm"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              <button type="button" onClick={() => pick(NEW)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-emerald-300 hover:bg-emerald-500/10">
                ➕ New ingredient…
              </button>

              {q ? (
                <>
                  {matches.length === 0 && <p className="px-3 py-4 text-center text-xs text-zinc-500">No ingredients match “{query}”.</p>}
                  {matches.map((f) => (
                    <button key={f.id} type="button" onClick={() => pick(f.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10 ${f.id === value ? "bg-emerald-500/15" : ""}`}>
                      <span>{f.emoji}</span> <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </>
              ) : (
                FOOD_CATEGORIES.map((cat) => {
                  const list = foods.filter((f) => f.category === cat.key);
                  if (list.length === 0) return null;
                  const isOpen = expanded.has(cat.key);
                  return (
                    <div key={cat.key}>
                      <button type="button" onClick={() => toggle(cat.key)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:bg-white/[0.05]">
                        <span>{cat.emoji} {cat.label} <span className="font-normal text-zinc-600">· {list.length}</span></span>
                        <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && list.map((f) => (
                        <button key={f.id} type="button" onClick={() => pick(f.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10 ${f.id === value ? "bg-emerald-500/15" : ""}`}>
                          <span>{f.emoji}</span> <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Add recipe modal (manual) ----

interface Row {
  foodId: string; // existing food id or NEW
  quantity: number;
  newName: string;
  newEmoji: string;
  newUnit: Unit;
  newCalories: number;
  newProtein: number;
  newCarbs: number;
  newFat: number;
  newLocation: Location;
  newCategory: FoodCategory;
}

const emptyRow = (foodId: string): Row => ({
  foodId, quantity: 1, newName: "", newEmoji: "🥕", newUnit: "each",
  newCalories: 50, newProtein: 0, newCarbs: 0, newFat: 0, newLocation: "fridge", newCategory: "vegetable",
});

function AddRecipeModal({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { foods, recipes, addRecipe, updateRecipe, addFood } = useApp();
  const editing = !!recipe;
  const [name, setName] = useState(recipe?.name ?? "");
  const [emoji, setEmoji] = useState(recipe?.emoji ?? "🍽️");
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [mealCat, setMealCat] = useState<MealType>(recipe?.category ?? "breakfast");
  const [rows, setRows] = useState<Row[]>(
    recipe && recipe.ingredients.length
      ? recipe.ingredients.map((ing) => ({ ...emptyRow(ing.foodId), quantity: ing.quantity }))
      : [emptyRow(foods[0]?.id ?? NEW)],
  );
  const [components, setComponents] = useState<RecipeComponent[]>(recipe?.components ?? []);
  const [steps, setSteps] = useState((recipe?.steps ?? []).join("\n"));

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Recipes that can be folded in: everything except this one and ones already added.
  const availableRecipes = recipes.filter((r) => r.id !== recipe?.id && !components.some((c) => c.recipeId === r.id));

  const { total, perServing } = useMemo(() => {
    const ingT = rows.reduce((sum, row) => {
      const calPerUnit = row.foodId === NEW ? row.newCalories : foodById(foods, row.foodId)?.caloriesPerUnit ?? 0;
      return sum + calPerUnit * row.quantity;
    }, 0);
    const compT = components.reduce((sum, c) => sum + componentCalories(c, foods, recipes), 0);
    const t = ingT + compT;
    return { total: Math.round(t), perServing: Math.round(t / Math.max(1, servings)) };
  }, [rows, components, servings, foods, recipes]);

  const save = () => {
    if (!name.trim()) return;
    const newFoods: Food[] = [];
    const ingredients = rows
      .map((row) => {
        if (row.quantity <= 0) return null;
        if (row.foodId === NEW) {
          if (!row.newName.trim()) return null;
          const id = newId();
          newFoods.push({
            id, name: row.newName.trim(), emoji: row.newEmoji || "🥕", unit: row.newUnit,
            caloriesPerUnit: Math.max(0, row.newCalories), protein: Math.max(0, row.newProtein),
            carbs: Math.max(0, row.newCarbs), fat: Math.max(0, row.newFat),
            location: row.newLocation, category: row.newCategory,
          });
          return { foodId: id, quantity: row.quantity };
        }
        return { foodId: row.foodId, quantity: row.quantity };
      })
      .filter((x): x is { foodId: string; quantity: number } => x !== null);

    if (ingredients.length === 0 && components.length === 0) return;
    const built: Recipe = {
      id: recipe?.id ?? newId(),
      name: name.trim(), emoji, servings: Math.max(1, servings),
      ingredients,
      components: components.length ? components : undefined,
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      category: mealCat,
    };
    if (editing) {
      newFoods.forEach((f) => addFood(f, 0));
      updateRecipe(built);
    } else {
      addRecipe(built, newFoods);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950/95 p-6 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editing ? "Edit recipe" : "New recipe"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-14 rounded-lg field px-2 py-2 text-center text-xl" />
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" className="flex-1 rounded-lg field px-3 py-2" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Servings</span>
              <input type="number" value={servings} onChange={(e) => setServings(Number(e.target.value))} className="w-20 rounded-lg field px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Meal</span>
              <select value={mealCat} onChange={(e) => setMealCat(e.target.value as MealType)} className="rounded-lg field px-2 py-1.5">
                {MEAL_ORDER.map((mt) => <option key={mt} value={mt}>{MEAL_LABEL[mt]}</option>)}
              </select>
            </label>
          </div>

          {/* Include other recipes (sub-recipes) */}
          <div>
            <div className="mb-2 text-sm font-medium text-zinc-400">Include a recipe</div>
            <div className="space-y-2">
              {components.map((c, i) => {
                const sub = recipes.find((r) => r.id === c.recipeId);
                return (
                  <div key={c.recipeId} className="flex items-center gap-2 rounded-xl border border-white/10 p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{sub?.emoji} {sub?.name ?? "Unknown recipe"}</span>
                    <input
                      type="number" min={0.5} step={0.5} value={c.servings}
                      onChange={(e) => { const v = Math.max(0.5, Number(e.target.value) || 0.5); setComponents((cs) => cs.map((x, idx) => (idx === i ? { ...x, servings: v } : x))); }}
                      className="w-16 rounded-lg field px-2 py-1 text-right text-sm"
                    />
                    <span className="w-12 shrink-0 text-xs text-zinc-500">serv.</span>
                    <span className="w-14 shrink-0 text-right text-xs text-rose-400/80">{componentCalories(c, foods, recipes)} cal</span>
                    <button onClick={() => setComponents((cs) => cs.filter((_, idx) => idx !== i))} className="shrink-0 text-zinc-500 hover:text-rose-400" aria-label="Remove recipe"><Trash2 size={14} /></button>
                  </div>
                );
              })}
              {availableRecipes.length > 0 ? (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) setComponents((cs) => [...cs, { recipeId: e.target.value, servings: 1 }]); }}
                  className="w-full rounded-lg field px-2 py-2 text-sm"
                >
                  <option value="">➕ Add a recipe to this meal…</option>
                  {availableRecipes.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                </select>
              ) : (
                <p className="text-xs text-zinc-500">No other recipes available to include.</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-zinc-400">Ingredients</div>
            <div className="space-y-3">
              {rows.map((row, i) => {
                const isNew = row.foodId === NEW;
                const unit = isNew ? row.newUnit : foods.find((f) => f.id === row.foodId)?.unit ?? "each";
                const rowCals = Math.round((isNew ? row.newCalories : foodById(foods, row.foodId)?.caloriesPerUnit ?? 0) * row.quantity);
                return (
                  <div key={i} className="rounded-xl border border-white/10 p-2.5">
                    <div className="flex gap-2">
                      <IngredientPicker foods={foods} value={row.foodId} onChange={(v) => update(i, { foodId: v })} />
                      <input type="number" value={row.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} className="w-16 rounded-lg field px-2 py-1.5 text-sm" />
                      <span className="flex w-12 items-center text-xs text-zinc-400">{unitLabel(unit)}</span>
                    </div>

                    {isNew && (
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2">
                        <input value={row.newEmoji} onChange={(e) => update(i, { newEmoji: e.target.value })} placeholder="🥕" className="rounded-lg field px-2 py-1.5 text-center text-sm" />
                        <input value={row.newName} onChange={(e) => update(i, { newName: e.target.value })} placeholder="Ingredient name" className="rounded-lg field px-2 py-1.5 text-sm" />
                        <select value={row.newUnit} onChange={(e) => update(i, { newUnit: e.target.value as Unit })} className="rounded-lg field px-2 py-1.5 text-sm">
                          {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                        <input type="number" value={row.newCalories} onChange={(e) => update(i, { newCalories: Number(e.target.value) })} placeholder="cal/unit" className="rounded-lg field px-2 py-1.5 text-sm" />
                        <div className="col-span-2 grid grid-cols-3 gap-2">
                          <input type="number" value={row.newProtein} onChange={(e) => update(i, { newProtein: Number(e.target.value) })} placeholder="protein g" className="rounded-lg field px-2 py-1.5 text-sm" />
                          <input type="number" value={row.newCarbs} onChange={(e) => update(i, { newCarbs: Number(e.target.value) })} placeholder="carbs g" className="rounded-lg field px-2 py-1.5 text-sm" />
                          <input type="number" value={row.newFat} onChange={(e) => update(i, { newFat: Number(e.target.value) })} placeholder="fat g" className="rounded-lg field px-2 py-1.5 text-sm" />
                        </div>
                        <select value={row.newLocation} onChange={(e) => update(i, { newLocation: e.target.value as Location })} className="rounded-lg field px-2 py-1.5 text-sm">
                          <option value="fridge">Store in Fridge</option>
                          <option value="freezer">Store in Freezer</option>
                          <option value="pantry">Store in Pantry</option>
                        </select>
                        <select value={row.newCategory} onChange={(e) => update(i, { newCategory: e.target.value as FoodCategory })} className="rounded-lg field px-2 py-1.5 text-sm">
                          {FOOD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-rose-400/80">{rowCals} cal</span>
                      {rows.length > 1 && (
                        <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-[11px] text-zinc-400 hover:text-rose-400">remove</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setRows((rs) => [...rs, emptyRow(foods[0]?.id ?? NEW)])} className="mt-2 text-sm font-medium text-emerald-400 hover:text-emerald-300">+ Add ingredient</button>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-zinc-400">Steps (one per line)</div>
            <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder={"Chop the vegetables\nSauté until soft"} className="w-full rounded-lg field px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-rose-950/30 px-4 py-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-rose-300"><Flame size={15} /> {perServing} cal / serving</span>
            <span className="text-rose-400/70">{total} cal total</span>
          </div>

          <button onClick={save} className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-3 font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">{editing ? "Save changes" : "Save recipe"}</button>
        </div>
      </div>
    </div>
  );
}
