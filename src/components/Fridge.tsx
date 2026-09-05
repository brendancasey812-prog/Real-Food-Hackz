"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, X, ChefHat } from "lucide-react";
import { useApp } from "@/lib/store";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { fmtQty, pluralUnit } from "@/lib/units";
import { Appliance, Shelf, TileGrid, AppTile, CATEGORY_TINT } from "./shelf";
import { FoodSheet } from "./FoodSheet";
import { RecipeBuilderSheet } from "./RecipeBuilderSheet";
import type { Food, FoodCategory, Location } from "@/lib/types";

const ZONES: { key: Location; label: string; icon: string }[] = [
  { key: "fridge", label: "Fridge", icon: "🧊" },
  { key: "freezer", label: "Freezer", icon: "❄️" },
  { key: "pantry", label: "Pantry", icon: "🫙" },
];

/**
 * Where each food group lives in the cabinet. Produce goes in the crisper
 * drawers at the bottom and condiments in the door bin, the way a real fridge
 * is laid out — everything else sits on a glass shelf.
 */
const FURNITURE: Record<FoodCategory, "shelf" | "drawer" | "door" | "rack"> = {
  protein: "shelf",
  dairy: "shelf",
  grain: "shelf",
  starch: "shelf",
  legume: "shelf",
  nut: "shelf",
  fat: "shelf",
  vegetable: "drawer",
  fruit: "drawer",
  condiment: "door",
  // Little jars and cut herbs get their own rack rather than sharing the
  // door bin with the ketchup.
  spice: "rack",
};


export function Fridge() {
  const { foods, inventory, setInventory } = useApp();

  const [zone, setZone] = useState<Location>("fridge");
  const [open, setOpen] = useState<FoodCategory | null>(null);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [detail, setDetail] = useState<Food | null>(null);
  const [building, setBuilding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const qtyOf = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;

  // Groups present in this zone, in the shelf order defined by foodcat.
  const groups = useMemo(() => {
    return FOOD_CATEGORIES.map((c) => ({
      ...c,
      foods: foods
        .filter((f) => f.location === zone && f.category === c.key)
        .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.foods.length > 0);
  }, [foods, zone, q]);

  const shelves = groups.filter((g) => FURNITURE[g.key] === "shelf");
  const drawers = groups.filter((g) => FURNITURE[g.key] === "drawer");
  const doors = groups.filter((g) => FURNITURE[g.key] === "door");
  const racks = groups.filter((g) => FURNITURE[g.key] === "rack");

  const toggleChosen = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const stopPicking = () => {
    setPicking(false);
    setChosen([]);
  };

  // The "added to the Cookbook" note clears itself.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  const groupProps = (g: (typeof groups)[number]) => ({
    group: g,
    // A search hit opens every matching group, so results aren't hidden.
    open: q ? true : open === g.key,
    onToggle: () => setOpen((o) => (o === g.key ? null : g.key)),
    qtyOf,
    picking,
    chosen,
    onPick: toggleChosen,
    onOpenFood: setDetail,
  });

  return (
    <>
      {/* Zone picker + ingredient-picking switch */}
      <div className="mb-4 space-y-2">
        <div className="flex rounded-xl border border-line bg-surface p-0.5 text-sm sm:w-fit">
          {ZONES.map((z) => (
            <button
              key={z.key}
              onClick={() => { setZone(z.key); setOpen(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors sm:flex-none ${
                zone === z.key
                  ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>{z.icon}</span> {z.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this zone…"
            className="field w-full rounded-xl py-2 pl-9 pr-8 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <Switch
          on={picking}
          onChange={(v) => (v ? setPicking(true) : stopPicking())}
          label="Pick ingredients"
        />
        </div>
      </div>

      {picking && (
        <p className="mb-3 rounded-xl border border-accent bg-accent-wash px-4 py-2.5 text-sm text-accent-soft">
          Tap the foods you want to cook with, then build a recipe from them.
        </p>
      )}

      {/* --- The cabinet --- */}
      <Appliance>
        <>
          {groups.length === 0 ? (
            <p className="glass rounded-2xl px-4 py-10 text-center text-sm text-muted">
              {q ? `Nothing matching “${query}” in the ${zone}.` : "This zone is empty — add a food to fill it."}
            </p>
          ) : (
            <>
              {shelves.map((g) => <FoodShelf key={g.key} {...groupProps(g)} />)}

              {doors.length > 0 && (
                <div className="pt-1">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Door bin
                  </p>
                  {doors.map((g) => <FoodShelf key={g.key} {...groupProps(g)} />)}
                </div>
              )}

              {racks.length > 0 && (
                <div className="pt-1">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Spice rack
                  </p>
                  {racks.map((g) => <FoodShelf key={g.key} {...groupProps(g)} />)}
                </div>
              )}

              {drawers.length > 0 && (
                <div className="pt-1">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Crisper drawers
                  </p>
                  <div className={drawers.length > 1 ? "grid items-start gap-2.5 sm:grid-cols-2" : ""}>
                    {drawers.map((g) => <FoodShelf key={g.key} {...groupProps(g)} drawer />)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      </Appliance>

      {/* Selection bar — the one action while picking */}
      {picking && chosen.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 md:bottom-8">
          <div className="sheet-up pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-page px-3 py-2.5 shadow-2xl">
            <span className="pl-1 text-sm text-muted">
              <span className="font-semibold text-ink">{chosen.length}</span>{" "}
              {chosen.length === 1 ? "ingredient" : "ingredients"}
            </span>
            <button onClick={() => setChosen([])} className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:text-ink">
              Clear
            </button>
            <button
              onClick={() => setBuilding(true)}
              className="btn-accent rounded-xl px-4 py-2 text-sm"
            >
              Build recipe
            </button>
          </div>
        </div>
      )}

      {/* Confirmation, with a way straight to the thing you just made */}
      {saved && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 md:bottom-8">
          <div className="sheet-up pointer-events-auto flex items-center gap-3 rounded-2xl border border-accent bg-page px-4 py-3 shadow-2xl">
            <Check size={16} className="shrink-0 text-accent-soft" />
            <span className="text-sm text-ink">
              Added <span className="font-semibold">{saved}</span> to your Cookbook
            </span>
            <Link href="/recipes" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent-soft hover:bg-accent-wash">
              View
            </Link>
          </div>
        </div>
      )}

      {detail && (
        <FoodSheet
          food={detail}
          quantity={qtyOf(detail.id)}
          onQuantity={(v) => setInventory(detail.id, v)}
          onClose={() => setDetail(null)}
        />
      )}

      {building && (
        <RecipeBuilderSheet
          foodIds={chosen}
          onClose={() => setBuilding(false)}
          onSaved={(recipeName) => {
            setBuilding(false);
            stopPicking();
            setSaved(recipeName);
          }}
        />
      )}
    </>
  );
}

/** A fridge section: the shared glass shelf, filled with food icons. */
function FoodShelf({
  group, open, onToggle, qtyOf, picking, chosen, onPick, onOpenFood, drawer = false,
}: {
  group: { key: FoodCategory; label: string; emoji: string; foods: Food[] };
  open: boolean;
  onToggle: () => void;
  qtyOf: (id: string) => number;
  picking: boolean;
  chosen: string[];
  onPick: (id: string) => void;
  onOpenFood: (f: Food) => void;
  drawer?: boolean;
}) {
  const stocked = group.foods.filter((f) => qtyOf(f.id) > 0).length;
  const pickedHere = group.foods.filter((f) => chosen.includes(f.id)).length;

  return (
    <Shelf
      emoji={group.emoji}
      title={group.label}
      subtitle={
        <>
          {stocked} of {group.foods.length} stocked
          {pickedHere > 0 && <span className="text-accent-soft"> · {pickedHere} picked</span>}
        </>
      }
      open={open}
      onToggle={onToggle}
      drawer={drawer}
    >
      <TileGrid>
        {group.foods.map((f) => {
          const quantity = qtyOf(f.id);
          const empty = quantity <= 0;
          // You can only cook with what you actually have.
          const disabled = picking && empty;
          const picked = chosen.includes(f.id);
          return (
            <AppTile
              key={f.id}
              emoji={f.emoji}
              name={f.name}
              tint={CATEGORY_TINT[f.category]}
              selected={picked}
              dimmed={empty && !picking}
              disabled={disabled}
              onClick={() => (picking ? onPick(f.id) : onOpenFood(f))}
              badge={picking ? <Check size={11} strokeWidth={3} /> : fmtQty(quantity)}
              badgeTone={picking ? (picked ? "accent" : "outline") : empty ? "muted" : "accent"}
              sub={`${fmtQty(quantity)} ${pluralUnit(quantity, f.unit)}`}
            />
          );
        })}
      </TileGrid>
    </Shelf>
  );
}

/** An iOS-style toggle. */
function Switch({
  on, onChange, label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      title={label}
      aria-label={label}
      className="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2"
    >
      <ChefHat size={16} className={on ? "text-accent-soft" : "text-muted"} />
      <span className="hidden sm:inline">{label}</span>
      <span
        className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-accent" : "bg-track"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-on-accent shadow transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
