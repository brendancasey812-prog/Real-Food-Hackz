"use client";

import { useRef, useState } from "react";
import {
  X, Clock, Users, Flame, PenLine, Trash2, ImagePlus, Loader2, ListChecks,
  UtensilsCrossed, DollarSign, CalendarPlus, ChevronDown,
} from "lucide-react";
import {
  useApp, foodById, ingredientCalories, componentCalories,
  recipeCaloriesPerServing, recipeTotalCalories, recipeTotalsPerServing,
} from "@/lib/store";
import {
  recipeTotalCost, recipeCostPerServing, ingredientCost, fmtMoney,
} from "@/lib/cost";
import { pluralUnit, fmtQty } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { MEAL_LABEL } from "@/lib/week";
import { MEAL_COLOR } from "@/lib/mealtime";
import { fileToThumbnail } from "@/lib/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddToPlanSheet } from "./AddToPlanSheet";

/**
 * The full-screen read view of a recipe, opened by clicking a card in either
 * cookbook tab: photo, facts, macros, ingredients, sub-recipes and the cooking
 * instructions side by side — with Edit and Delete kept close at hand.
 */
export function RecipeDetailModal({
  recipeId, onClose, onEdit, onRemove,
}: {
  recipeId: string;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { recipes, foods, updateRecipe, prices, selectedStoreId } = useApp();
  const recipe = recipes.find((r) => r.id === recipeId);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [planning, setPlanning] = useState(false);

  if (!recipe) return null;

  const perServing = recipeCaloriesPerServing(recipe, foods, recipes);
  const total = recipeTotalCalories(recipe, foods, recipes);
  const costTotal = recipeTotalCost(recipe, recipes, prices, selectedStoreId);
  const costPer = recipeCostPerServing(recipe, recipes, prices, selectedStoreId);
  const missingPrices = costTotal.lines - costTotal.priced;
  const m = recipeTotalsPerServing(recipe, foods, recipes);
  const comps = recipe.components ?? [];
  const color = MEAL_COLOR[recipe.category];

  // A long shopping-style list is hard to read straight through, so the
  // ingredients are split the way the kitchen is: proteins together, produce
  // together, pantry together — each section collapsible.
  const categoryOf = (foodId: string) => foodById(foods, foodId)?.category;
  const ingredientGroups = FOOD_CATEGORIES
    .map((c) => ({
      key: c.key as string,
      emoji: c.emoji,
      label: c.label,
      items: recipe.ingredients.filter((ing) => categoryOf(ing.foodId) === c.key),
    }))
    .filter((g) => g.items.length > 0);
  // Ingredients whose food has gone missing still have to show up somewhere.
  const orphans = recipe.ingredients.filter((ing) => !categoryOf(ing.foodId));
  if (orphans.length > 0) {
    ingredientGroups.push({ key: "other", emoji: "❓", label: "Other", items: orphans });
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setImgError("");
    try {
      updateRecipe({ ...recipe, image: await fileToThumbnail(file) });
    } catch (e) {
      setImgError(e instanceof Error ? e.message : "Couldn't add that image.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color.soft}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
            {MEAL_LABEL[recipe.category]}
          </span>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close recipe"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Hero photo — a real photo gets room; an empty placeholder stays a
              slim strip so the recipe itself is what fills the screen. */}
          <div className={`relative w-full overflow-hidden bg-page ${recipe.image ? "max-h-[42vh] aspect-[21/9]" : "h-24"}`}>
            {recipe.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL, no optimizer
              <img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-page text-faint">
                <ImagePlus size={18} />
                <span className="text-xs">No photo yet</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-scrim px-3 py-1.5 text-xs font-medium text-on-accent backdrop-blur-sm hover:bg-scrim disabled:opacity-60"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {recipe.image ? "Replace photo" : "Add photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div className="p-5 md:p-6">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{recipe.name}</h2>
            {imgError && <p className="mt-2 text-xs text-danger-soft">{imgError}</p>}

            {/* Facts */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-muted" /> {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-cal-soft"><Flame size={14} /> {perServing.toLocaleString()} cal / serving</span>
              <span className="text-muted">{total.toLocaleString()} cal total</span>
              {costTotal.priced > 0 && (
                <>
                  <span className="inline-flex items-center gap-1.5 font-medium text-accent-soft">
                    <DollarSign size={14} /> {fmtMoney(costPer.cost)} / serving
                  </span>
                  <span className="text-muted">
                    {fmtMoney(costTotal.cost)} total
                    {missingPrices > 0 && (
                      <span className="ml-1 text-warn-soft">+{missingPrices} unpriced</span>
                    )}
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-muted" /> {recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : "No cook time set"}</span>
            </div>

            {/* Macros */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Protein", value: m.protein, cls: "text-protein-soft bg-protein/15" },
                { label: "Carbs", value: m.carbs, cls: "text-carbs-soft bg-carbs/15" },
                { label: "Fat", value: m.fat, cls: "text-fat-soft bg-fat/15" },
              ].map((x) => (
                <div key={x.label} className={`rounded-xl px-3 py-2.5 text-center ${x.cls.split(" ")[1]}`}>
                  <div className={`text-lg font-semibold ${x.cls.split(" ")[0]}`}>{x.value}g</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">{x.label} / serving</div>
                </div>
              ))}
            </div>

            {/* Ingredients + instructions, side by side on desktop */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
                  <ListChecks size={15} className="text-accent-soft" /> Ingredients
                  <span className="font-normal text-muted">{recipe.ingredients.length + comps.length}</span>
                </h3>
                <div className="space-y-2">
                  {comps.length > 0 && (
                    <IngredientGroup
                      emoji="🍽️"
                      label="Recipes"
                      count={comps.length}
                      calories={comps.reduce((sum, c) => sum + componentCalories(c, foods, recipes), 0)}
                    >
                      {comps.map((c) => {
                        const sub = recipes.find((x) => x.id === c.recipeId);
                        return (
                          <div key={`c-${c.recipeId}`} className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-sm">
                            <span className="truncate font-medium text-accent-soft">{sub?.name ?? "Unknown recipe"}</span>
                            <span className="shrink-0 text-muted">
                              {fmtQty(c.servings)} serv · <span className="text-cal-soft">{componentCalories(c, foods, recipes)} cal</span>
                            </span>
                          </div>
                        );
                      })}
                    </IngredientGroup>
                  )}

                  {ingredientGroups.map((g) => (
                    <IngredientGroup
                      key={g.key}
                      emoji={g.emoji}
                      label={g.label}
                      count={g.items.length}
                      calories={g.items.reduce((sum, ing) => sum + ingredientCalories(ing, foods), 0)}
                    >
                      {g.items.map((ing) => {
                        const f = foodById(foods, ing.foodId);
                        const c = ingredientCost(ing, prices, selectedStoreId);
                        return (
                          <div key={ing.foodId} className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-sm">
                            <span className="min-w-0 truncate text-ink">{f?.emoji} {f?.name ?? ing.foodId}</span>
                            <span className="shrink-0 text-muted">
                              {fmtQty(ing.quantity)} {f ? pluralUnit(ing.quantity, f.unit) : ""} ·{" "}
                              <span className="text-cal-soft">{ingredientCalories(ing, foods)} cal</span>
                              {c != null ? (
                                <span className="text-accent-soft"> · {fmtMoney(c)}</span>
                              ) : (
                                <span className="text-warn-soft"> · no price</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </IngredientGroup>
                  ))}

                  {recipe.ingredients.length + comps.length === 0 && (
                    <p className="rounded-xl border border-line px-3 py-4 text-center text-xs text-muted">No ingredients yet.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
                  <UtensilsCrossed size={15} className="text-accent-soft" /> Instructions
                </h3>
                {recipe.steps.length > 0 ? (
                  <ol className="space-y-2.5">
                    {recipe.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-6 text-ink-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-wash text-[11px] font-semibold text-accent-soft">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                    No cooking instructions yet — add them with Edit.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-line px-5 py-3.5">
          <button onClick={() => setConfirming(true)} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-danger-soft hover:bg-danger/10">
            <Trash2 size={15} /> Delete
          </button>
          <button
            onClick={() => setPlanning(true)}
            className="ml-auto flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3"
          >
            <CalendarPlus size={15} className="text-accent-soft" /> Add to plan
          </button>
          <button onClick={onEdit} className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep px-5 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
            <PenLine size={15} /> Edit recipe
          </button>
        </div>
      </div>

      {planning && <AddToPlanSheet recipe={recipe} onClose={() => setPlanning(false)} />}

      {confirming && (
        <ConfirmDialog
          title="Delete recipe?"
          message={`“${recipe.name}” will be permanently removed from your cookbook and any calendar days it’s planned on. This can’t be undone.`}
          confirmLabel="Delete recipe"
          onConfirm={() => { setConfirming(false); onRemove(); onClose(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/**
 * One food group inside the ingredient list — open by default, since reading
 * the recipe is the point, but foldable once you've bought that part.
 */
function IngredientGroup({
  emoji, label, count, calories, children,
}: {
  emoji: string;
  label: string;
  count: number;
  calories: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-surface px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-2 transition-colors hover:bg-surface-3"
      >
        <span className="text-sm">{emoji}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 font-normal normal-case text-muted">
          {count} · <span className="text-cal-soft">{Math.round(calories).toLocaleString()} cal</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children}
    </div>
  );
}
