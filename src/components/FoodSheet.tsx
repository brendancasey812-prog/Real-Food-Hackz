"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, X, BookMarked, PenLine, Trash2, Check } from "lucide-react";
import { useApp } from "@/lib/store";
import { usdaFor, canApplyUsda, SOURCE_LABEL } from "@/lib/usda";
import { fmtQty, pluralUnit, stepFor, unitLabel, sliderMax } from "@/lib/units";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABEL } from "@/lib/foodcat";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Food, FoodCategory, Location } from "@/lib/types";

const LOCATIONS: { key: Location; label: string; icon: string }[] = [
  { key: "fridge", label: "Fridge", icon: "🧊" },
  { key: "freezer", label: "Freezer", icon: "❄️" },
  { key: "pantry", label: "Pantry", icon: "🫙" },
];

const LOCATION_LABEL: Record<Location, string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  pantry: "Pantry",
};

/**
 * Tapping a food opens this sheet — the one place to change how much you have,
 * with its nutrition alongside so the number means something.
 */
export function FoodSheet({
  food, quantity, onQuantity, onClose,
}: {
  food: Food;
  quantity: number;
  onQuantity: (q: number) => void;
  onClose: () => void;
}) {
  // Read the food back out of the store rather than trusting the snapshot the
  // shelf handed over: everything below edits it, and the sheet has to show the
  // change. The fallback covers the moment after a delete, before it closes.
  const f = useApp((s) => s.foods.find((x) => x.id === food.id)) ?? food;
  const updateFood = useApp((s) => s.updateFood);
  const removeFood = useApp((s) => s.removeFood);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const step = stepFor(f.unit);
  const max = sliderMax(f.unit, quantity);
  const set = (q: number) => onQuantity(Math.max(0, Number(q.toFixed(2))));

  // The USDA table is the fallback reference: offered when the user hasn't
  // established better numbers themselves, never applied behind their back.
  const reference = usdaFor(f);
  const offerReference =
    reference != null &&
    canApplyUsda(f) &&
    reference.nutrition.caloriesPerUnit !== f.caloriesPerUnit;

  const applyReference = () => {
    if (!reference) return;
    updateFood(f.id, {
      ...reference.nutrition,
      nutritionSource: "usda",
      fdcId: reference.match.entry.id,
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const macros = [
    { label: "Protein", value: f.protein, text: "text-protein-soft", bg: "bg-protein/12" },
    { label: "Carbs", value: f.carbs, text: "text-carbs-soft", bg: "bg-carbs/12" },
    { label: "Fat", value: f.fat, text: "text-fat-soft", bg: "bg-fat/12" },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-page p-5 pb-8 md:rounded-3xl md:pb-5"
      >
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line-2 md:hidden" />

        <div className="flex items-start gap-4">
          <span className="squircle flex h-16 w-16 shrink-0 items-center justify-center bg-gradient-to-br from-accent/25 to-accent/10 text-[30px] ring-1 ring-accent/20">
            {f.emoji}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="truncate text-lg font-semibold text-ink">{f.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {FOOD_CATEGORY_LABEL[f.category]} · {LOCATION_LABEL[f.location]}
              {f.notes ? ` · ${f.notes}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {/* How much you have */}
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">On hand</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              onClick={() => set(quantity - step)}
              aria-label="Less"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Minus size={18} />
            </button>
            <div className="text-center">
              <input
                type="number"
                min={0}
                step={step}
                value={quantity}
                onChange={(e) => set(Number(e.target.value) || 0)}
                aria-label={`${f.name} quantity`}
                className="w-24 rounded-xl field px-2 py-1.5 text-center text-2xl font-semibold tabular-nums"
              />
              <p className="mt-1 text-xs text-muted">{pluralUnit(quantity, f.unit)}</p>
            </div>
            <button
              onClick={() => set(quantity + step)}
              aria-label="More"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={max}
            step={step}
            value={Math.min(quantity, max)}
            onChange={(e) => set(Number(e.target.value))}
            aria-label={`${f.name} slider`}
            className="mt-4 h-1.5 w-full cursor-pointer accent-accent"
          />
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-faint">
            <span>0</span>
            <span>{fmtQty(max)} {pluralUnit(max, f.unit)}</span>
          </div>
        </div>

        {/* Where it lives — moving a food re-shelves it everywhere at once */}
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Stored in</p>
          <div className="mt-2 flex rounded-xl border border-line bg-page p-0.5 text-sm">
            {LOCATIONS.map((l) => (
              <button
                key={l.key}
                onClick={() => updateFood(f.id, { location: l.key })}
                aria-pressed={f.location === l.key}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-medium transition-colors ${
                  f.location === l.key
                    ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>{l.icon}</span> {l.label}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Shelf</span>
            <select
              value={f.category}
              onChange={(e) => updateFood(f.id, { category: e.target.value as FoodCategory })}
              className="field min-w-0 flex-1 rounded-xl px-2 py-2 text-sm"
            >
              {FOOD_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* What it's worth */}
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Per {unitLabel(f.unit)}
            </p>
            <p className="text-sm text-muted">
              <span className="font-semibold text-cal-soft tabular-nums">
                {Math.round(quantity * f.caloriesPerUnit).toLocaleString()}
              </span>{" "}
              cal on hand
            </p>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-cal/12 py-2">
              <div className="text-sm font-semibold tabular-nums text-cal-soft">{f.caloriesPerUnit}</div>
              <div className="text-[10px] text-muted">cal</div>
            </div>
            {macros.map((m) => (
              <div key={m.label} className={`rounded-xl py-2 ${m.bg}`}>
                <div className={`text-sm font-semibold tabular-nums ${m.text}`}>{m.value}g</div>
                <div className="text-[10px] text-muted">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Where these numbers came from, and the reference if there's a better one */}
        {(f.nutritionSource || offerReference) && (
          <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
            {f.nutritionSource && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <BookMarked size={12} className="shrink-0" />
                {SOURCE_LABEL[f.nutritionSource]}
                {f.nutritionSource === "usda" && f.fdcId ? ` · #${f.fdcId}` : ""}
              </p>
            )}
            {offerReference && reference && (
              <>
                <p className="mt-1 text-[11px] leading-4 text-muted">
                  USDA FoodData Central lists{" "}
                  <span className="text-ink-2">{reference.match.entry.n}</span> at{" "}
                  <span className="font-medium text-cal-soft">
                    {reference.nutrition.caloriesPerUnit} cal
                  </span>{" "}
                  / {unitLabel(f.unit)} · {reference.nutrition.protein}p{" "}
                  {reference.nutrition.carbs}c {reference.nutrition.fat}f.
                </p>
                <button
                  onClick={applyReference}
                  className="mt-2 w-full rounded-xl border border-line bg-surface-2 py-2 text-xs font-medium text-ink-2 transition-colors hover:bg-accent-wash hover:text-accent-soft"
                >
                  Use the USDA reference
                </button>
              </>
            )}
          </div>
        )}

        {/* Rename it, fix its numbers, or get rid of it — without leaving the shelf */}
        {editing && (
          <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex gap-2">
              <input
                value={f.emoji}
                onChange={(e) => updateFood(f.id, { emoji: e.target.value || "🍽️" })}
                aria-label="Emoji"
                className="field w-14 rounded-xl px-2 py-2 text-center text-xl"
              />
              <input
                value={f.name}
                onChange={(e) => updateFood(f.id, { name: e.target.value })}
                aria-label="Food name"
                className="field min-w-0 flex-1 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted">Cal / {unitLabel(f.unit)}</span>
                <input type="number" min={0} value={f.caloriesPerUnit}
                  onChange={(e) => updateFood(f.id, { caloriesPerUnit: Math.max(0, Number(e.target.value) || 0), nutritionSource: "manual" })}
                  className="field w-20 rounded-lg px-2 py-1.5 text-right" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-protein-soft">Protein g</span>
                <input type="number" min={0} value={f.protein}
                  onChange={(e) => updateFood(f.id, { protein: Math.max(0, Number(e.target.value) || 0), nutritionSource: "manual" })}
                  className="field w-20 rounded-lg px-2 py-1.5 text-right" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-carbs-soft">Carbs g</span>
                <input type="number" min={0} value={f.carbs}
                  onChange={(e) => updateFood(f.id, { carbs: Math.max(0, Number(e.target.value) || 0), nutritionSource: "manual" })}
                  className="field w-20 rounded-lg px-2 py-1.5 text-right" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-fat-soft">Fat g</span>
                <input type="number" min={0} value={f.fat}
                  onChange={(e) => updateFood(f.id, { fat: Math.max(0, Number(e.target.value) || 0), nutritionSource: "manual" })}
                  className="field w-20 rounded-lg px-2 py-1.5 text-right" />
              </label>
            </div>
            <p className="text-[10px] leading-4 text-muted">
              Per {unitLabel(f.unit)}. Saves as you type, and the cookbook, planner and
              costs follow immediately.
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setConfirmDel(true)}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-3 text-sm font-medium text-danger-soft hover:bg-danger/10"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors ${
              editing ? "border-accent bg-accent-wash text-accent-soft" : "border-line text-ink-2 hover:bg-surface-3"
            }`}
          >
            <PenLine size={15} /> Edit
          </button>
          <button onClick={onClose} className="btn-accent flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm">
            <Check size={15} /> Done
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          {fmtQty(quantity)} {pluralUnit(quantity, f.unit)} · updates the grocery list and planner instantly
        </p>

        {confirmDel && (
          <ConfirmDialog
            title="Delete food?"
            message={`“${f.name}” will be removed from your kitchen, recipes, and grocery list. This can’t be undone.`}
            confirmLabel="Delete food"
            onConfirm={() => { setConfirmDel(false); removeFood(f.id); onClose(); }}
            onCancel={() => setConfirmDel(false)}
          />
        )}
      </div>
    </div>
  );
}
