"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { fmtQty, pluralUnit, unitLabel } from "@/lib/units";
import { fmtMoney, priceFor, BASE_STORE_ID, type ResolvedPrice } from "@/lib/cost";
import { Appliance, Shelf, TileGrid, AppTile, TileTick, CATEGORY_TINT } from "./shelf";
import { FoodSheet } from "./FoodSheet";
import type { Food, FoodCategory, Location } from "@/lib/types";

/**
 * The one browser behind the Food Tracker, the Grocery list and the Costs
 * repository.
 *
 * All three are views of the same catalogue, so they are the same screen: the
 * zone you're looking in, a search, and glass shelves grouped by food type.
 * Only the number on the tile changes — what you have, what to buy, what it
 * costs — and tapping any tile anywhere opens the same sheet, where all of it
 * can be edited. That is why an edit made in one tab shows up in the others.
 */
export type ShelfMode = "stock" | "shop" | "price";

const ZONES: { key: Location | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fridge", label: "Fridge" },
  { key: "freezer", label: "Freezer" },
  { key: "pantry", label: "Pantry" },
];

export function FoodShelves({
  mode, foods, buyOf, checked, onTick, picking = false, chosen = [], onPick, extraControl
}: {
  mode: ShelfMode;
  /** The foods this tab is about. */
  foods: Food[];
  /** How much of a food still needs buying this week. */
  buyOf?: (foodId: string) => number;
  /** Shopping only: which lines are ticked off. */
  checked?: Record<string, boolean>;
  onTick?: (food: Food) => void;
  /** Food Tracker only: picking ingredients to build a recipe from. */
  picking?: boolean;
  chosen?: string[];
  onPick?: (id: string) => void;
  /** A control to sit beside the search box (the recipe-picking switch). */
  extraControl?: React.ReactNode;
}) {
  const { inventory, setInventory, prices, selectedStoreId } = useApp();
  const [zone, setZone] = useState<Location | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<FoodCategory | "closed" | null>(null);
  const [detail, setDetail] = useState<Food | null>(null);

  const q = query.trim().toLowerCase();
  const qtyOf = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;
  const buy = (id: string) => buyOf?.(id) ?? 0;

  const groups = useMemo(() => {
    const inZone = foods
      .filter((f) => (zone === "all" ? true : f.location === zone))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true));
    return FOOD_CATEGORIES.map((c) => ({
      ...c,
      foods: inZone
        .filter((f) => f.category === c.key)
        .sort((a, b) => a.name.localeCompare(b.name))
    })).filter((g) => g.foods.length > 0);
  }, [foods, zone, q]);

  // The first shelf opens by default so the tab isn't a wall of closed doors;
  // a search opens everything, so no match can hide behind a shut one.
  const isOpen = (key: FoodCategory) =>
    q ? true : open === null ? key === groups[0]?.key : open === key;

  /** What the shelf header says it holds, in this tab's terms. */
  const summarise = (list: Food[]) => {
    if (mode === "price") {
      const priced = list.filter((f) => priceFor(prices, selectedStoreId, f.id) !== null).length;
      return `${priced} of ${list.length} priced`;
    }
    if (mode === "shop") {
      const left = list.filter((f) => !checked?.[f.id]).length;
      return left === 0 ? "all picked up" : `${left} to buy`;
    }
    const stocked = list.filter((f) => qtyOf(f.id) > 0).length;
    const short = list.filter((f) => buy(f.id) > 0.001).length;
    return `${stocked} of ${list.length} stocked${short > 0 ? ` · ${short} short` : ""}`;
  };

  return (
    <>
      <div className="mb-4 space-y-2">
        <div className="flex rounded-xl border border-line bg-surface p-0.5 text-sm sm:w-fit">
          {ZONES.map((z) => (
            <button
              key={z.key}
              onClick={() => { setZone(z.key); setOpen(null); }}
              aria-pressed={zone === z.key}
              className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors sm:flex-none ${
                zone === z.key
                  ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
                  : "text-muted hover:text-ink"
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods…"
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
          {extraControl}
        </div>
      </div>

      <Appliance>
        {groups.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-10 text-center text-sm text-muted">
            {q ? `Nothing matching “${query}” here.` : "Nothing on these shelves yet."}
          </p>
        ) : (
          groups.map((g) => (
            <Shelf
              key={g.key}
              title={g.label}
              subtitle={summarise(g.foods)}
              open={isOpen(g.key)}
              onToggle={() => setOpen(isOpen(g.key) ? "closed" : g.key)}
            >
              <TileGrid>
                {g.foods.map((f) => (
                  <FoodTile
                    key={f.id}
                    food={f}
                    mode={mode}
                    have={qtyOf(f.id)}
                    buy={buy(f.id)}
                    price={priceFor(prices, selectedStoreId, f.id)}
                    baseStore={selectedStoreId === BASE_STORE_ID}
                    done={Boolean(checked?.[f.id])}
                    picking={picking}
                    picked={chosen.includes(f.id)}
                    onOpen={() => (picking ? onPick?.(f.id) : setDetail(f))}
                    onTick={onTick ? () => onTick(f) : undefined}
                  />
                ))}
              </TileGrid>
            </Shelf>
          ))
        )}
      </Appliance>

      {detail && (
        <FoodSheet
          food={detail}
          quantity={qtyOf(detail.id)}
          onQuantity={(v) => setInventory(detail.id, v)}
          buy={buy(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

/** One food, showing whichever number this tab is about. */
function FoodTile({
  food: f, mode, have, buy, price, baseStore, done, picking, picked, onOpen, onTick
}: {
  food: Food;
  mode: ShelfMode;
  have: number;
  buy: number;
  price: ResolvedPrice | null;
  baseStore: boolean;
  done: boolean;
  picking: boolean;
  picked: boolean;
  onOpen: () => void;
  onTick?: () => void;
}) {
  const cals = `${Math.round(f.caloriesPerUnit).toLocaleString()} cal / ${unitLabel(f.unit)}`;
  const money = price ? fmtMoney(price.pricePerUnit) : null;

  if (mode === "price") {
    const fromBase = price?.source === "base" && !baseStore;
    return (
      <AppTile
        name={f.name}
        tint={CATEGORY_TINT[f.category]}
        value={price ? price.pricePerUnit.toFixed(2) : "—"}
        unit={price ? `/ ${unitLabel(f.unit)}` : "no price"}
        tone={price ? (fromBase ? "muted" : "accent") : "warn"}
        dimmed={!price}
        sub={fromBase ? <span className="text-sea-soft">base price</span> : cals}
        onClick={onOpen}
        ariaLabel={`Set the price of ${f.name}`}
      />
    );
  }

  if (mode === "shop") {
    const ask = Math.ceil(buy * 4) / 4;
    return (
      <AppTile
        name={f.name}
        tint={CATEGORY_TINT[f.category]}
        value={fmtQty(ask)}
        unit={pluralUnit(ask, f.unit)}
        tone={done ? "muted" : "accent"}
        dimmed={done}
        strike={done}
        selected={done}
        sub={money ? <span className="text-accent-soft">{fmtMoney((price?.pricePerUnit ?? 0) * buy)}</span> : <span className="text-warn-soft">no price</span>}
        onClick={onOpen}
        ariaLabel={`Open ${f.name}`}
        corner={onTick && <TileTick on={done} label={`${done ? "Undo buying" : "Buy"} ${f.name}`} onClick={onTick} />}
      />
    );
  }

  const empty = have <= 0;
  const short = buy > 0.001;
  return (
    <AppTile
      name={f.name}
      tint={CATEGORY_TINT[f.category]}
      value={fmtQty(have)}
      unit={pluralUnit(have, f.unit)}
      tone={picking ? (picked ? "accent" : "muted") : empty ? "muted" : short ? "warn" : "accent"}
      dimmed={empty && !picking}
      disabled={picking && empty}
      selected={picking && picked}
      sub={short ? <span className="text-warn-soft">need {fmtQty(Math.ceil(buy * 4) / 4)}</span> : cals}
      onClick={onOpen}
      ariaLabel={picking ? `Cook with ${f.name}` : `Open ${f.name}`}
    />
  );
}
