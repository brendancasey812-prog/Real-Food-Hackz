"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ArrowLeft, ArrowRight, MoveHorizontal, ListChecks, ChefHat, Check } from "lucide-react";
import { useApp } from "@/lib/store";
import { FOOD_CATEGORIES, byShelfOrder } from "@/lib/foodcat";
import { gramsForFood } from "@/lib/usda";
import { fmtQty, pluralUnit, unitLabel, pricePerBuyUnit } from "@/lib/units";
import { fmtMoney, fmtMoneyShort, priceFor, BASE_STORE_ID, type ResolvedPrice } from "@/lib/cost";
import { Appliance, Shelf, TileGrid, AppTile, TileTick, CATEGORY_TINT } from "./shelf";
import { FoodSheet } from "./FoodSheet";
import { EditItemsSheet } from "./EditItems";
import { RecipeBuilderSheet } from "./RecipeBuilderSheet";
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
 *
 * The controls are the same everywhere for the same reason. Arranging shelves,
 * editing the catalogue and cooking a recipe out of what you tap are things
 * you do to your foods, not to a tab, so they live here rather than in any one
 * page — whichever tab you happen to be on is the one that can do them.
 */
export type ShelfMode = "stock" | "shop" | "price";

const ZONES: { key: Location | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fridge", label: "Fridge" },
  { key: "freezer", label: "Freezer" },
  { key: "pantry", label: "Pantry" },
];

export function FoodShelves({
  mode, foods, buyOf, checked, onTick
}: {
  mode: ShelfMode;
  /** The foods this tab is about. */
  foods: Food[];
  /** How much of a food still needs buying this week. */
  buyOf?: (foodId: string) => number;
  /** Shopping only: which lines are ticked off. */
  checked?: Record<string, boolean>;
  onTick?: (food: Food) => void;
}) {
  const { inventory, setInventory, prices, selectedStoreId, moveFood,
    tilesPerRow, setTilesPerRow } = useApp();
  const [arranging, setArranging] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [zone, setZone] = useState<Location | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<FoodCategory | null>(null);
  const [detail, setDetail] = useState<Food | null>(null);
  // Cooking out of the shelves: tap foods, then turn them into a recipe.
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const onPick = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const stopPicking = () => { setPicking(false); setChosen([]); };

  // The "added to the Cookbook" note clears itself.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  const q = query.trim().toLowerCase();
  const qtyOf = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;
  const buy = (id: string) => buyOf?.(id) ?? 0;

  // How much one of each food weighs, worked out once per catalogue change:
  // a price shown per pound needs it, and looking it up per tile per render
  // would rescan the reference table hundreds of times a keystroke.
  const gramsOf = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const f of foods) m[f.id] = f.buyUnit ? (gramsForFood(f)?.grams ?? null) : null;
    return m;
  }, [foods]);

  const groups = useMemo(() => {
    const inZone = foods
      .filter((f) => (zone === "all" ? true : f.location === zone))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true));
    return FOOD_CATEGORIES.map((c) => ({
      ...c,
      foods: inZone.filter((f) => f.category === c.key).sort(byShelfOrder)
    })).filter((g) => g.foods.length > 0);
  }, [foods, zone, q]);

  // Shelves start shut, the way a kitchen does — you open the one you want.
  // A search opens everything, so no match can hide behind a closed door.
  const isOpen = (key: FoodCategory) => (q ? true : open === key);

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
        <div className="flex flex-wrap items-center justify-between gap-2">
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

        <PerRow value={tilesPerRow ?? null} onChange={setTilesPerRow} />
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
          <button
            onClick={() => setArranging((v) => !v)}
            aria-pressed={arranging}
            title="Arrange the order of foods on each shelf"
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              arranging
                ? "bg-accent text-on-accent"
                : "border border-line bg-surface text-ink-2 hover:bg-surface-3"
            }`}
          >
            <MoveHorizontal size={16} />
            <span className="hidden sm:inline">Arrange</span>
          </button>
          <button
            onClick={() => setEditingItems(true)}
            title="Rename, move or delete any food"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-3"
          >
            <ListChecks size={16} />
            <span className="hidden sm:inline">Edit items</span>
          </button>
          <PickSwitch
            on={picking}
            onChange={(v) => (v ? setPicking(true) : stopPicking())}
          />
        </div>
      </div>

      {arranging && (
        <p className="mb-3 rounded-xl border border-accent bg-accent-wash px-4 py-2.5 text-sm text-accent-soft">
          Use the arrows on each food to put your shelves in the order you like.
          Anything you haven&apos;t moved stays in alphabetical order.
        </p>
      )}

      {picking && (
        <p className="mb-3 rounded-xl border border-accent bg-accent-wash px-4 py-2.5 text-sm text-accent-soft">
          Tap the foods you want to cook with, then build a recipe from them.
        </p>
      )}

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
              onToggle={() => setOpen(isOpen(g.key) ? null : g.key)}
            >
              <TileGrid columns={tilesPerRow ?? null}>
                {g.foods.map((f, idx) => (
                  <FoodTile
                    key={f.id}
                    food={f}
                    mode={mode}
                    have={qtyOf(f.id)}
                    buy={buy(f.id)}
                    price={priceFor(prices, selectedStoreId, f.id)}
                    grams={gramsOf[f.id] ?? null}
                    baseStore={selectedStoreId === BASE_STORE_ID}
                    done={Boolean(checked?.[f.id])}
                    picking={picking}
                    picked={chosen.includes(f.id)}
                    onOpen={() => (picking ? onPick(f.id) : setDetail(f))}
                    onTick={onTick ? () => onTick(f) : undefined}
                    arrange={
                      arranging
                        ? { first: idx === 0, last: idx === g.foods.length - 1, onMove: (d) => moveFood(f.id, d) }
                        : undefined
                    }
                  />
                ))}
              </TileGrid>
            </Shelf>
          ))
        )}
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
            <button onClick={() => setBuilding(true)} className="btn-accent rounded-xl px-4 py-2 text-sm">
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
          buy={buy(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}

      {editingItems && <EditItemsSheet onClose={() => setEditingItems(false)} />}

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

/** The toggle that turns the shelves into an ingredient picker. */
function PickSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const label = "Pick ingredients";
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      title="Tap foods off the shelf and build a recipe from them"
      aria-label={label}
      className="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2"
    >
      <ChefHat size={16} className={on ? "text-accent-soft" : "text-muted"} />
      <span className="hidden sm:inline">{label}</span>
      <span className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-accent" : "bg-track"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-on-accent shadow transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/** One food, showing whichever number this tab is about. */
function FoodTile({
  food: f, mode, have, buy, price, grams, baseStore, done, picking, picked, onOpen, onTick, arrange
}: {
  food: Food;
  mode: ShelfMode;
  have: number;
  buy: number;
  price: ResolvedPrice | null;
  /** What one of this food weighs, when its price is quoted by weight. */
  grams: number | null;
  baseStore: boolean;
  done: boolean;
  picking: boolean;
  picked: boolean;
  onOpen: () => void;
  onTick?: () => void;
  /** Present while the shelf is being rearranged. */
  arrange?: { first: boolean; last: boolean; onMove: (delta: -1 | 1) => void };
}) {
  const cals = `${Math.round(f.caloriesPerUnit).toLocaleString()} cal / ${unitLabel(f.unit)}`;
  const money = price ? fmtMoney(price.pricePerUnit) : null;

  /**
   * While picking, a tile is a tile: the same label and the same selected look
   * on all three tabs, and nothing greyed out or struck through, because what
   * you can cook with doesn't depend on which tab you started from — or on
   * whether you happen to have it in right now.
   */
  const asPicker = picking
    ? {
        tone: picked ? ("accent" as const) : ("muted" as const),
        selected: picked,
        dimmed: false,
        strike: false,
        disabled: false,
        ariaLabel: `Cook with ${f.name}`,
        corner: undefined,
      }
    : {};

  /** Shown in place of the tile's usual corner while a shelf is arranged. */
  const arrows = arrange ? (
    <span className="flex gap-0.5">
      <button
        onClick={() => arrange.onMove(-1)}
        disabled={arrange.first}
        aria-label={`Move ${f.name} earlier`}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-page text-muted shadow-sm hover:text-ink disabled:opacity-25"
      >
        <ArrowLeft size={12} />
      </button>
      <button
        onClick={() => arrange.onMove(1)}
        disabled={arrange.last}
        aria-label={`Move ${f.name} later`}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-page text-muted shadow-sm hover:text-ink disabled:opacity-25"
      >
        <ArrowRight size={12} />
      </button>
    </span>
  ) : undefined;

  if (mode === "price") {
    const fromBase = price?.source === "base" && !baseStore;
    const shown = price ? pricePerBuyUnit(price.pricePerUnit, f, grams) : null;
    return (
      <AppTile
        name={f.name}
        tint={CATEGORY_TINT[f.category]}
        value={shown ? fmtMoneyShort(shown.amount) : "—"}
        unit={shown ? `/ ${shown.label}` : "no price"}
        tone={price ? (fromBase ? "muted" : "accent") : "warn"}
        dimmed={!price}
        sub={fromBase ? <span className="text-sea-soft">base price</span> : cals}
        onClick={onOpen}
        ariaLabel={`Set the price of ${f.name}`}
        corner={arrows}
        {...asPicker}
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
        corner={arrows ?? (onTick && <TileTick on={done} label={`${done ? "Undo buying" : "Buy"} ${f.name}`} onClick={onTick} />)}
        {...asPicker}
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
      tone={empty ? "muted" : short ? "warn" : "accent"}
      dimmed={empty}
      sub={short ? <span className="text-warn-soft">need {fmtQty(Math.ceil(buy * 4) / 4)}</span> : cals}
      onClick={onOpen}
      ariaLabel={`Open ${f.name}`}
      corner={arrows}
      {...asPicker}
    />
  );
}

/**
 * How many foods go on a shelf row.
 *
 * Three is a big readable tile you can hit with a wet thumb; six fits a whole
 * shelf on screen at once. Neither is right for everyone or every screen, so
 * both are one tap away and the box beside them takes any number — and "Auto"
 * hands the decision back to the screen, which is where it starts.
 */
function PerRow({
  value, onChange
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  const preset = (n: number | null, label: string) => (
    <button
      key={label}
      onClick={() => onChange(n)}
      aria-pressed={value === n}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        value === n ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <label className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface p-0.5 pl-2.5 text-sm">
      <span className="pr-1 text-xs font-medium text-muted">Per row</span>
      {preset(null, "Auto")}
      {preset(3, "3")}
      {preset(6, "6")}
      <input
        type="number"
        min={1}
        max={12}
        value={value ?? ""}
        placeholder="…"
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v === "" ? null : Number(v));
        }}
        aria-label="Foods per row"
        className={`field w-12 rounded-lg px-1.5 py-1 text-center text-xs tabular-nums ${
          value != null && value !== 3 && value !== 6 ? "ring-1 ring-accent" : ""
        }`}
      />
    </label>
  );
}
