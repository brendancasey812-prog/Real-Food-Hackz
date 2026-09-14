"use client";

import { useState } from "react";
import { Plus, Trash2, Flame, Menu, ChevronDown, Camera, PenLine, ClipboardList, CalendarPlus, Wand2 } from "lucide-react";
import {
  useApp,
  recipeCaloriesPerServing,
  recipeTotalCalories,
  recipeTotalsPerServing,
  ingredientCalories,
  componentCalories,
  foodById
} from "@/lib/store";
import { pluralUnit, fmtQty } from "@/lib/units";
import { householdSize, portionsFor, portionNote } from "@/lib/household";
import { MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import { RecipeScanModal } from "@/components/RecipeScanModal";
import { AddRecipeModal } from "@/components/AddRecipeModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { RecipeCardV2 } from "@/components/RecipeCardV2";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import type { Food, MealType, Recipe } from "@/lib/types";
import { SettingsButton } from "@/components/SettingsButton";
import { AddToPlanSheet } from "@/components/AddToPlanSheet";
import { SingleFoodsTab } from "@/components/SingleFoodsTab";

export default function Cookbook() {
  const { recipes, foods, removeRecipe } = useApp();
  const [manualOpen, setManualOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [filterMenu, setFilterMenu] = useState(false);
  const [visible, setVisible] = useState<Set<MealType>>(new Set(MEAL_ORDER));
  const [collapsed, setCollapsed] = useState<Set<MealType>>(new Set());
  const [search, setSearch] = useState("");
  const [secFilter, setSecFilter] = useState("all");
  const [tab, setTab] = useState<"classic" | "v2" | "fruit">("v2");
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const q = search.trim().toLowerCase();

  // Single-food stand-ins (one apple, one banana) live in the Fruit tab and are
  // kept out of the recipe lists so they never pad them out.
  const cookbook = recipes.filter((r) => !r.single);

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
              className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-3"
              aria-label="Filter sections"
            >
              <Menu size={18} />
            </button>
            {filterMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFilterMenu(false)} />
                <div className="absolute left-0 z-40 mt-2 w-48 rounded-xl border border-line bg-page p-2 shadow-xl">
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Show sections</div>
                  {MEAL_ORDER.map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-3">
                      <input type="checkbox" checked={visible.has(m)} onChange={() => toggleMeal(m)} className="accent-accent" />
                      {MEAL_LABEL[m]}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cookbook</h1>
            <p className="mt-1 text-sm text-muted">
              {tab === "fruit"
                ? "single fruits · calories and price for one"
                : `${cookbook.length} recipes · calories from each ingredient`}
            </p>
          </div>
        </div>

        {/* Add recipe dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setAddMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep px-4 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110"
          >
            <Plus size={16} /> Add recipe <ChevronDown size={14} />
          </button>
          {addMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAddMenu(false)} />
              <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-line bg-page p-1 shadow-xl">
                <button onClick={() => { setAddMenu(false); setAiOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                  <Wand2 size={16} className="text-accent-soft" /> Build with AI
                </button>
                <button onClick={() => { setAddMenu(false); setScanOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                  <Camera size={16} className="text-accent-soft" /> Scan recipe (camera)
                </button>
                <button onClick={() => { setAddMenu(false); setTextOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                  <ClipboardList size={16} className="text-accent-soft" /> Paste text (AI)
                </button>
                <button onClick={() => { setAddMenu(false); setManualOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                  <PenLine size={16} className="text-accent-soft" /> Manually enter
                </button>
              </div>
            </>
          )}
        </div>
        <SettingsButton className="hidden md:flex" />
      </header>

      {/* Cookbook / Cookbook V2 */}
      <div className="mb-4 flex w-fit rounded-xl border border-line bg-surface p-0.5 text-sm">
        {([["classic", "Cookbook"], ["v2", "Cookbook V2"], ["fruit", "Fruit"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${
              tab === k ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "fruit" ? <SingleFoodsTab /> : <>
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
          const list = cookbook.filter((r) => r.category === meal && (q ? r.name.toLowerCase().includes(q) : true));
          if (list.length === 0) return null;
          const isCollapsed = !q && collapsed.has(meal);
          return (
            <section key={meal}>
              <button
                onClick={() => toggleCollapsed(meal)}
                className="mb-3 flex w-full items-center gap-2 text-lg font-semibold"
                aria-expanded={!isCollapsed}
              >
                <ChevronDown size={18} className={`text-muted transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                {MEAL_LABEL[meal]}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-muted">{list.length}</span>
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
        {cookbook.filter((r) => visible.has(r.category) && (secFilter === "all" || secFilter === r.category) && (q ? r.name.toLowerCase().includes(q) : true)).length === 0 && (
          <p className="py-16 text-center text-sm text-muted">{q ? `No recipes match “${search}”.` : "No recipes in the selected sections."}</p>
        )}
      </div>
      </>}

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
      {aiOpen && <RecipeScanModal mode="ai" onClose={() => setAiOpen(false)} />}
    </div>
  );
}

function RecipeCard({ recipe: r, foods, recipes, onOpen, onEdit, onRemove }: { recipe: Recipe; foods: Food[]; recipes: Recipe[]; onOpen: () => void; onEdit: () => void; onRemove: () => void }) {
  const { householdMode, members } = useApp();
  const size = householdSize({ householdMode, members });
  const perServing = recipeCaloriesPerServing(r, foods, recipes);
  const total = recipeTotalCalories(r, foods, recipes);
  const m = recipeTotalsPerServing(r, foods, recipes);
  const [menu, setMenu] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div onClick={onOpen} className="flex cursor-pointer flex-col rounded-2xl card p-5 transition-colors hover:border-accent">
      <div className="flex items-start justify-between">
        {/* Hamburger menu (top-right) */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenu((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink" aria-label="Recipe menu">
            <Menu size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-40 mt-1 w-44 rounded-xl border border-line bg-page p-1 shadow-xl">
                <button onClick={() => { setMenu(false); onEdit(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-accent-wash">
                  <PenLine size={15} className="text-accent-soft" /> Edit
                </button>
                <button onClick={() => { setMenu(false); setPlanning(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-accent-wash">
                  <CalendarPlus size={15} className="text-accent-soft" /> Add to plan
                </button>
                <button onClick={() => { setMenu(false); setConfirming(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-soft hover:bg-danger/10">
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-2 font-semibold">{r.name}</h3>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-cal/12 px-2.5 py-1 text-xs font-semibold text-cal-soft">
          <Flame size={12} /> {perServing} cal / serving
        </span>
        <span className="text-xs text-muted">{total} total · {portionNote(portionsFor(r, size))}</span>
      </div>
      <div className="mt-2 flex gap-1.5 text-[11px]">
        <span className="rounded-md bg-protein/15 px-2 py-0.5 font-medium text-protein-soft">P {m.protein}g</span>
        <span className="rounded-md bg-carbs/15 px-2 py-0.5 font-medium text-carbs-soft">C {m.carbs}g</span>
        <span className="rounded-md bg-fat/15 px-2 py-0.5 font-medium text-fat-soft">F {m.fat}g</span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {(r.components ?? []).map((c) => {
          const sub = recipes.find((x) => x.id === c.recipeId);
          if (!sub) return null;
          return (
            <li key={`c-${c.recipeId}`} className="flex justify-between gap-2">
              <span className="truncate font-medium text-accent-soft">{sub.name}</span>
              <span className="shrink-0 text-muted">
                {fmtQty(c.servings)} serv ·{" "}
                <span className="text-cal-soft">{componentCalories(c, foods, recipes)} cal</span>
              </span>
            </li>
          );
        })}
        {r.ingredients.map((ing) => {
          const f = foodById(foods, ing.foodId);
          return (
            <li key={ing.foodId} className="flex justify-between gap-2">
              <span className="truncate">{f?.name ?? ing.foodId}</span>
              <span className="shrink-0 text-muted">
                {fmtQty(ing.quantity)} {f ? pluralUnit(ing.quantity, f.unit) : ""} ·{" "}
                <span className="text-cal-soft">{ingredientCalories(ing, foods)} cal</span>
              </span>
            </li>
          );
        })}
      </ul>

      {planning && <AddToPlanSheet recipe={r} onClose={() => setPlanning(false)} />}

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
