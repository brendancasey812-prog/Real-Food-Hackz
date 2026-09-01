"use client";

import { useRef, useState } from "react";
import { ImagePlus, Clock, Users, Flame, Menu, PenLine, Trash2, Loader2 } from "lucide-react";
import { useApp, recipeCaloriesPerServing, recipeTotalsPerServing } from "@/lib/store";
import { fileToThumbnail } from "@/lib/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Food, Recipe } from "@/lib/types";

/**
 * The Cookbook V2 card: photo-forward and text-clean — a large image, the name,
 * then servings / calories / macros / cook time. No emoji by design.
 */
export function RecipeCardV2({
  recipe: r, foods, recipes, onEdit, onRemove,
}: {
  recipe: Recipe;
  foods: Food[];
  recipes: Recipe[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { updateRecipe } = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const perServing = recipeCaloriesPerServing(r, foods, recipes);
  const m = recipeTotalsPerServing(r, foods, recipes);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setImgError("");
    try {
      updateRecipe({ ...r, image: await fileToThumbnail(file) });
    } catch (e) {
      setImgError(e instanceof Error ? e.message : "Couldn't add that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group/card flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/[0.14]">
      {/* Large photo */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URLs, no optimizer
          <img src={r.image} alt={r.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800/60 to-zinc-900 text-zinc-600">
            <ImagePlus size={28} />
            <span className="text-xs">No photo yet</span>
          </div>
        )}

        {/* Upload / replace */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/85 disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {r.image ? "Replace" : "Add photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }}
        />

        {/* Menu */}
        <div className="absolute right-2 top-2">
          <button
            onClick={() => setMenu((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-zinc-200 backdrop-blur-sm hover:bg-black/80"
            aria-label={`${r.name} menu`}
          >
            <Menu size={15} />
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

      {/* Name + facts */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-snug text-zinc-100">{r.name}</h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Users size={13} className="text-zinc-500" />
            {r.servings} serving{r.servings === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-300">
            <Flame size={13} />
            {perServing.toLocaleString()} cal
          </span>
          <CookTime recipe={r} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
          {[
            { label: "Protein", value: m.protein, color: "text-rose-300" },
            { label: "Carbs", value: m.carbs, color: "text-amber-300" },
            { label: "Fat", value: m.fat, color: "text-sky-300" },
          ].map((x) => (
            <div key={x.label}>
              <div className={`text-sm font-semibold ${x.color}`}>{x.value}g</div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">{x.label}</div>
            </div>
          ))}
        </div>

        {imgError && <p className="mt-2 text-[11px] text-rose-300">{imgError}</p>}
      </div>

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

/** Cook time, editable inline — most recipes don't have one yet. */
function CookTime({ recipe: r }: { recipe: Recipe }) {
  const { updateRecipe } = useApp();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Clock size={13} className="text-zinc-500" />
        <input
          autoFocus
          type="number"
          min={0}
          defaultValue={r.cookTimeMin ?? ""}
          onBlur={(e) => {
            const v = Number(e.target.value);
            updateRecipe({ ...r, cookTimeMin: Number.isFinite(v) && v > 0 ? Math.round(v) : undefined });
            setEditing(false);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-14 rounded-md field px-1.5 py-0.5 text-xs"
        />
        <span className="text-zinc-500">min</span>
      </span>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 hover:text-zinc-200">
      <Clock size={13} className="text-zinc-500" />
      {r.cookTimeMin ? `${r.cookTimeMin} min` : <span className="text-zinc-500">Set time</span>}
    </button>
  );
}
