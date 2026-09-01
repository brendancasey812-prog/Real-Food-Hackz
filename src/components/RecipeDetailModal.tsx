"use client";

import { useRef, useState } from "react";
import {
  X, Clock, Users, Flame, PenLine, Trash2, ImagePlus, Loader2, ListChecks, UtensilsCrossed,
} from "lucide-react";
import {
  useApp, foodById, ingredientCalories, componentCalories,
  recipeCaloriesPerServing, recipeTotalCalories, recipeTotalsPerServing,
} from "@/lib/store";
import { pluralUnit, fmtQty } from "@/lib/units";
import { MEAL_LABEL } from "@/lib/week";
import { MEAL_COLOR } from "@/lib/mealtime";
import { fileToThumbnail } from "@/lib/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  const { recipes, foods, updateRecipe } = useApp();
  const recipe = recipes.find((r) => r.id === recipeId);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!recipe) return null;

  const perServing = recipeCaloriesPerServing(recipe, foods, recipes);
  const total = recipeTotalCalories(recipe, foods, recipes);
  const m = recipeTotalsPerServing(recipe, foods, recipes);
  const comps = recipe.components ?? [];
  const color = MEAL_COLOR[recipe.category];

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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color.soft}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
            {MEAL_LABEL[recipe.category]}
          </span>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200" aria-label="Close recipe"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Hero photo — a real photo gets room; an empty placeholder stays a
              slim strip so the recipe itself is what fills the screen. */}
          <div className={`relative w-full overflow-hidden bg-zinc-900 ${recipe.image ? "max-h-[42vh] aspect-[21/9]" : "h-24"}`}>
            {recipe.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL, no optimizer
              <img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-2 bg-gradient-to-br from-zinc-800/60 to-zinc-900 text-zinc-600">
                <ImagePlus size={18} />
                <span className="text-xs">No photo yet</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/85 disabled:opacity-60"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {recipe.image ? "Replace photo" : "Add photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div className="p-5 md:p-6">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{recipe.name}</h2>
            {imgError && <p className="mt-2 text-xs text-rose-300">{imgError}</p>}

            {/* Facts */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-zinc-500" /> {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-rose-300"><Flame size={14} /> {perServing.toLocaleString()} cal / serving</span>
              <span className="text-zinc-500">{total.toLocaleString()} cal total</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-zinc-500" /> {recipe.cookTimeMin ? `${recipe.cookTimeMin} min` : "No cook time set"}</span>
            </div>

            {/* Macros */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Protein", value: m.protein, cls: "text-rose-300 bg-rose-950/30" },
                { label: "Carbs", value: m.carbs, cls: "text-amber-300 bg-amber-950/30" },
                { label: "Fat", value: m.fat, cls: "text-sky-300 bg-sky-950/30" },
              ].map((x) => (
                <div key={x.label} className={`rounded-xl px-3 py-2.5 text-center ${x.cls.split(" ")[1]}`}>
                  <div className={`text-lg font-semibold ${x.cls.split(" ")[0]}`}>{x.value}g</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{x.label} / serving</div>
                </div>
              ))}
            </div>

            {/* Ingredients + instructions, side by side on desktop */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                  <ListChecks size={15} className="text-emerald-400" /> Ingredients
                  <span className="font-normal text-zinc-500">{recipe.ingredients.length + comps.length}</span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                  {comps.map((c) => {
                    const sub = recipes.find((x) => x.id === c.recipeId);
                    return (
                      <div key={`c-${c.recipeId}`} className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-3 py-2.5 text-sm last:border-0">
                        <span className="truncate font-medium text-emerald-300">{sub?.name ?? "Unknown recipe"}</span>
                        <span className="shrink-0 text-zinc-400">
                          {fmtQty(c.servings)} serv · <span className="text-rose-400/80">{componentCalories(c, foods, recipes)} cal</span>
                        </span>
                      </div>
                    );
                  })}
                  {recipe.ingredients.map((ing) => {
                    const f = foodById(foods, ing.foodId);
                    return (
                      <div key={ing.foodId} className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-3 py-2.5 text-sm last:border-0">
                        <span className="min-w-0 truncate text-zinc-200">{f?.emoji} {f?.name ?? ing.foodId}</span>
                        <span className="shrink-0 text-zinc-400">
                          {fmtQty(ing.quantity)} {f ? pluralUnit(ing.quantity, f.unit) : ""} ·{" "}
                          <span className="text-rose-400/80">{ingredientCalories(ing, foods)} cal</span>
                        </span>
                      </div>
                    );
                  })}
                  {recipe.ingredients.length + comps.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-zinc-500">No ingredients yet.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                  <UtensilsCrossed size={15} className="text-emerald-400" /> Instructions
                </h3>
                {recipe.steps.length > 0 ? (
                  <ol className="space-y-2.5">
                    {recipe.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-6 text-zinc-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-300">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                    No cooking instructions yet — add them with Edit.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-white/[0.07] px-5 py-3.5">
          <button onClick={() => setConfirming(true)} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10">
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={onEdit} className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">
            <PenLine size={15} /> Edit recipe
          </button>
        </div>
      </div>

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
