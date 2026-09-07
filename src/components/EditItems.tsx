"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUp, ArrowDown, Trash2, X, ListChecks } from "lucide-react";
import { useApp } from "@/lib/store";
import { FOOD_CATEGORIES, byShelfOrder } from "@/lib/foodcat";
import { unitLabel } from "@/lib/units";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Food, FoodCategory, Location } from "@/lib/types";

const LOCATIONS: { key: Location; label: string }[] = [
  { key: "fridge", label: "Fridge" },
  { key: "freezer", label: "Freezer" },
  { key: "pantry", label: "Pantry" },
];

/**
 * Every food in one editable list, over the shelves it edits.
 *
 * The shelves are the good way to work with a few foods at a time; this is for
 * the other job — going through the whole catalogue, renaming the ones a
 * receipt named badly, moving a batch to the right shelf, and deleting what you
 * never actually buy. It opens from the Food Tracker because that is the tab
 * these foods belong to; a rename or a delete here reaches the whole app.
 */
export function EditItemsSheet({ onClose }: { onClose: () => void }) {
  const foods = useApp((s) => s.foods);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-6">
      <div className="sheet-up flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page shadow-2xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-wash text-accent-soft">
              <ListChecks size={18} />
            </span>
            <div>
              <h2 className="font-semibold">Edit items</h2>
              <p className="text-xs text-muted">{foods.length} foods in your kitchen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <EditItems />
        </div>

        <div className="border-t border-line px-5 py-3">
          <button onClick={onClose} className="btn-accent w-full rounded-xl py-2.5 text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** The list itself. */
function EditItems() {
  const { foods, updateFood, removeFood, moveFood } = useApp();
  const [query, setQuery] = useState("");
  const [where, setWhere] = useState<Location | "all">("all");
  const [confirming, setConfirming] = useState<Food | null>(null);

  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const visible = foods
      .filter((f) => (where === "all" ? true : f.location === where))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true));
    return FOOD_CATEGORIES.map((c) => ({
      ...c,
      foods: visible.filter((f) => f.category === c.key).sort(byShelfOrder),
    })).filter((g) => g.foods.length > 0);
  }, [foods, where, q]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your foods…"
            className="field w-full rounded-lg py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
        <select
          value={where}
          onChange={(e) => setWhere(e.target.value as Location | "all")}
          className="field rounded-lg px-2 py-1.5 text-sm"
          aria-label="Filter by where it's kept"
        >
          <option value="all">Everywhere</option>
          {LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
      </div>

      <p className="mb-2 text-[11px] leading-4 text-muted">
        Renaming, moving or deleting here changes a food everywhere — your recipes,
        your plan and your prices all follow.
      </p>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {g.label} <span className="font-normal text-faint">· {g.foods.length}</span>
            </p>
            <div className="overflow-hidden rounded-xl border border-line">
              {g.foods.map((f, i) => (
                <div key={f.id} className="border-b border-line px-2.5 py-2 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={f.name}
                      onChange={(e) => updateFood(f.id, { name: e.target.value })}
                      aria-label={`Name of ${f.name}`}
                      className="field min-w-0 flex-1 rounded-lg px-2 py-1 text-sm"
                    />
                    <span className="shrink-0 text-[10px] text-muted">
                      {f.caloriesPerUnit} cal / {unitLabel(f.unit)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <select
                      value={f.location}
                      onChange={(e) => updateFood(f.id, { location: e.target.value as Location })}
                      aria-label={`Where ${f.name} is kept`}
                      className="field rounded-lg px-2 py-1 text-xs"
                    >
                      {LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                    <select
                      value={f.category}
                      onChange={(e) => updateFood(f.id, { category: e.target.value as FoodCategory })}
                      aria-label={`Shelf for ${f.name}`}
                      className="field min-w-0 flex-1 rounded-lg px-2 py-1 text-xs"
                    >
                      {FOOD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>

                    <button
                      onClick={() => moveFood(f.id, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${f.name} up`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink disabled:opacity-25"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => moveFood(f.id, 1)}
                      disabled={i === g.foods.length - 1}
                      aria-label={`Move ${f.name} down`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink disabled:opacity-25"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      onClick={() => setConfirming(f)}
                      aria-label={`Delete ${f.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-danger/10 hover:text-danger-soft"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="py-6 text-center text-xs text-muted">
            {q ? `Nothing matches “${query}”.` : "No foods here yet."}
          </p>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete food?"
          message={`“${confirming.name}” will be removed from your kitchen, your recipes, your prices and your grocery list. If it was planned on its own as a single food, those meals go too. This can’t be undone.`}
          confirmLabel="Delete food"
          onConfirm={() => { removeFood(confirming.id); setConfirming(null); }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}
