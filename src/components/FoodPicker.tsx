"use client";

import { useMemo, useRef, useState } from "react";
import { Search, ChevronDown, Check, Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { unitLabel } from "@/lib/units";
import type { Food, FoodCategory } from "@/lib/types";

/** The value meaning "not one of these — make a new food". */
export const NEW_FOOD = "__new__";

/**
 * Picking a food out of the catalogue.
 *
 * A hundred-odd foods in a plain dropdown is a scroll, not a choice, so this
 * searches. It also leads with the ones you actually use — anything in your
 * kitchen, in a recipe, or carrying a price — because the food you want is
 * nearly always one you have had before, and the rest of the catalogue is
 * mostly things you tried once.
 */
export function FoodPicker({
  value, onChange, allowNew = true, newLabel = "New food…", placeholder = "Select a food…",
}: {
  value: string;
  onChange: (foodId: string) => void;
  allowNew?: boolean;
  newLabel?: string;
  placeholder?: string;
}) {
  const { foods, inventory, recipes, prices } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<FoodCategory>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = value === NEW_FOOD ? null : foods.find((f) => f.id === value);

  /** Foods actually on the shelf right now — the first place to look. */
  const stocked = useMemo(() => {
    const seen = new Set<string>();
    for (const i of inventory) if (i.quantity > 0) seen.add(i.foodId);
    return seen;
  }, [inventory]);

  /** Foods you have touched: stocked, cooked with, or priced. */
  const used = useMemo(() => {
    const seen = new Set(stocked);
    for (const r of recipes) for (const ing of r.ingredients) seen.add(ing.foodId);
    for (const p of prices) seen.add(p.foodId);
    return seen;
  }, [stocked, recipes, prices]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return foods
      .filter((f) => f.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          // What's in the fridge/pantry first, then anything else you use,
          // then the closer name match, then alphabetical.
          Number(stocked.has(b.id)) - Number(stocked.has(a.id)) ||
          Number(used.has(b.id)) - Number(used.has(a.id)) ||
          a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 30);
  }, [foods, q, used, stocked]);

  const recent = useMemo(
    () =>
      foods
        .filter((f) => used.has(f.id))
        .sort(
          (a, b) =>
            Number(stocked.has(b.id)) - Number(stocked.has(a.id)) || a.name.localeCompare(b.name),
        ),
    [foods, used, stocked],
  );

  const close = () => { setOpen(false); setQuery(""); };
  const pick = (id: string) => { onChange(id); close(); };
  const toggle = (k: FoodCategory) =>
    setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  /** How much of this food is actually on hand, so a search can say so. */
  const stockOf = (foodId: string) => inventory.find((i) => i.foodId === foodId && i.quantity > 0);

  const Row = ({ food }: { food: Food }) => {
    const stock = stockOf(food.id);
    return (
      <button
        type="button"
        onClick={() => pick(food.id)}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-accent-wash ${
          food.id === value ? "bg-accent-wash text-accent-soft" : "text-ink"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{food.name}</span>
        {stock && (
          <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent-soft">
            in {food.location}
          </span>
        )}
        <span className="shrink-0 text-[10px] text-muted">
          {food.caloriesPerUnit} cal / {unitLabel(food.unit)}
        </span>
        {food.id === value && <Check size={13} className="shrink-0 text-accent-soft" />}
      </button>
    );
  };

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        aria-expanded={open}
        className="field flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left text-sm"
      >
        <span className={`truncate ${selected || value === NEW_FOOD ? "" : "text-muted"}`}>
          {value === NEW_FOOD ? newLabel : selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute z-50 mt-1 flex max-h-80 w-full min-w-[240px] flex-col overflow-hidden rounded-xl border border-line bg-page shadow-2xl">
            <div className="relative border-b border-line p-2">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                  if (e.key === "Enter" && matches[0]) pick(matches[0].id);
                }}
                placeholder="Search foods…"
                className="field w-full rounded-lg py-1.5 pl-8 pr-2 text-sm"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {allowNew && (
                <button
                  type="button"
                  onClick={() => pick(NEW_FOOD)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-accent-soft hover:bg-accent-wash"
                >
                  <Plus size={14} /> {newLabel}
                </button>
              )}

              {q ? (
                matches.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted">
                    Nothing matches “{query}”.
                  </p>
                ) : (
                  matches.map((f) => <Row key={f.id} food={f} />)
                )
              ) : (
                <>
                  {recent.length > 0 && (
                    <>
                      <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Ones you use
                      </p>
                      {recent.map((f) => <Row key={f.id} food={f} />)}
                    </>
                  )}

                  <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Everything else
                  </p>
                  {FOOD_CATEGORIES.map((cat) => {
                    const list = foods.filter((f) => f.category === cat.key && !used.has(f.id));
                    if (list.length === 0) return null;
                    const isOpen = expanded.has(cat.key);
                    return (
                      <div key={cat.key}>
                        <button
                          type="button"
                          onClick={() => toggle(cat.key)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-muted hover:bg-surface-3"
                        >
                          <span>{cat.label} <span className="text-faint">· {list.length}</span></span>
                          <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && list.sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                          <Row key={f.id} food={f} />
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
