"use client";

import { useState } from "react";
import Link from "next/link";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight, Check, Plus } from "lucide-react";
import { useApp, neededQuantities, foodById } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { fmtQty, pluralUnit } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { AddFoodModal } from "@/components/AddFoodModal";
import type { Food, Location } from "@/lib/types";
import { BASE_STORE_ID, quantityCost, quantitiesCost, fmtMoney } from "@/lib/cost";
import { SettingsButton } from "@/components/SettingsButton";
import { GroceryShelves } from "@/components/GroceryShelves";
import { ViewToggle } from "@/components/shelf";

/** The order you actually walk a kitchen when you get home from the shop. */
const LOCATIONS: { key: Location; label: string; icon: string }[] = [
  { key: "fridge", label: "Fridge", icon: "🧊" },
  { key: "freezer", label: "Freezer", icon: "❄️" },
  { key: "pantry", label: "Pantry", icon: "🫙" },
];

export default function Groceries() {
  const { recipes, foods, plan, inventory, manualGroceries, prices, stores, selectedStoreId,
    setInventory, removeManualGrocery } = useApp();
  const [offset, setOffset] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Buying an item clears its shortfall, so it would otherwise vanish mid-shop.
  // Keep a snapshot of what was ticked off so it stays on the shelf, greyed
  // out and undoable, until the week is changed.
  const [bought, setBought] = useState<Record<string, { food: Food; buy: number; have: number }>>({});
  const [adding, setAdding] = useState(false);
  // Shelves match the Food Tracker; the list stays for straight-through ticking.
  const [view, setView] = useState<"shelves" | "list">("shelves");

  const changeWeek = (dir: number) => {
    setOffset((o) => o + dir);
    setChecked({});
    setBought({});
  };

  const days = weekDays(addWeeks(new Date(), offset)).map(isoOf);
  const need = neededQuantities(
    plan.filter((m) => days.includes(m.date)),
    recipes,
  );

  // Merge the auto-derived shortfall with any manually-added quantities.
  const buyByFood: Record<string, number> = {};
  for (const [foodId, qty] of Object.entries(need)) {
    const have = inventory.find((i) => i.foodId === foodId)?.quantity ?? 0;
    const shortfall = Math.max(0, qty - have);
    if (shortfall > 0.001) buyByFood[foodId] = shortfall;
  }
  for (const m of manualGroceries) {
    buyByFood[m.foodId] = (buyByFood[m.foodId] ?? 0) + m.quantity;
  }

  const items = Object.entries(buyByFood)
    .map(([foodId, buy]) => {
      const food = foodById(foods, foodId);
      const have = inventory.find((i) => i.foodId === foodId)?.quantity ?? 0;
      return { food, buy, have };
    })
    .filter((x) => x.food && x.buy > 0.001);

  const totalCals = items.reduce(
    (s, x) => s + Math.round(x.buy * x.food!.caloriesPerUnit),
    0,
  );

  // What this list costs at whichever store the app is currently costing against.
  const basket = quantitiesCost(
    Object.fromEntries(items.map((x) => [x.food!.id, x.buy])),
    prices,
    selectedStoreId,
  );
  const storeName =
    selectedStoreId === BASE_STORE_ID
      ? "base prices"
      : (stores.find((st) => st.id === selectedStoreId)?.name ?? "base prices");

  const markBought = (foodId: string, have: number, buy: number) => {
    setInventory(foodId, have + buy);
    manualGroceries.filter((m) => m.foodId === foodId).forEach((m) => removeManualGrocery(m.id));
    setChecked((c) => ({ ...c, [foodId]: true }));
    const food = foodById(foods, foodId);
    if (food) setBought((bt) => ({ ...bt, [foodId]: { food, buy, have } }));
  };

  /** Put back what a mis-tap added, and return the item to the list. */
  const undoBought = (foodId: string) => {
    const snap = bought[foodId];
    if (snap) setInventory(foodId, snap.have);
    setChecked((c) => { const n = { ...c }; delete n[foodId]; return n; });
    setBought((bt) => { const n = { ...bt }; delete n[foodId]; return n; });
  };

  /** The live list plus anything ticked off this session, so nothing jumps. */
  const shelfItems = [
    ...items.map((i) => ({ food: i.food!, buy: i.buy, have: i.have })),
    ...Object.values(bought).filter((bt) => !items.some((i) => i.food!.id === bt.food.id)),
  ];

  // The list is grouped the way you shop and then unpack: where it goes when
  // you get home, and within that the aisle it came from. A flat run of
  // twenty lines is what makes a list easy to lose your place in.
  const listGroups = LOCATIONS.map((loc) => {
    const here = shelfItems.filter((i) => i.food.location === loc.key);
    return {
      ...loc,
      left: here.filter((i) => !checked[i.food.id]).length,
      cost: here.reduce(
        (sum, i) => sum + (quantityCost(i.food.id, i.buy, prices, selectedStoreId) ?? 0),
        0,
      ),
      types: FOOD_CATEGORIES.map((cat) => ({
        ...cat,
        items: here
          .filter((i) => i.food.category === cat.key)
          .sort((a, b) => a.food.name.localeCompare(b.food.name)),
      })).filter((t) => t.items.length > 0),
    };
  }).filter((l) => l.types.length > 0);

  const toggleBought = (item: { food: Food; buy: number; have: number }) =>
    checked[item.food.id]
      ? undoBought(item.food.id)
      : markBought(item.food.id, item.have, item.buy);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Grocery list</h1>
          <p className="mt-1 text-sm text-muted">
            Auto-built from your plan minus what&apos;s in the kitchen
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep shadow-lg px-4 py-2.5 text-sm font-medium text-on-accent hover:brightness-110"
          >
            <Plus size={16} /> Add item
          </button>
          <SettingsButton className="hidden md:flex" />
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between rounded-xl card px-4 py-2.5 text-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => changeWeek(-1)} className="rounded-lg p-1 hover:bg-surface-3">
            <ChevronLeft size={16} />
          </button>
          <span className="px-1 text-muted">
            Week of {format(weekDays(addWeeks(new Date(), offset))[0], "MMM d")}
          </span>
          <button onClick={() => changeWeek(1)} className="rounded-lg p-1 hover:bg-surface-3">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted">{totalCals.toLocaleString()} cal</span>
          <span className="font-medium text-accent-soft tabular-nums">
            {basket.priced > 0 ? fmtMoney(basket.cost) : "—"}
            {basket.lines - basket.priced > 0 && (
              <span className="ml-1 text-[11px] font-normal text-warn-soft">
                +{basket.lines - basket.priced} unpriced
              </span>
            )}
          </span>
        </div>
      </div>

      <ViewToggle
        value={view}
        onChange={setView}
        options={[["shelves", "Shelves"], ["list", "List"]] as const}
      />

      {shelfItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 py-16 text-center text-sm text-muted">
          🎉 Your kitchen already has everything for this week&apos;s plan.
        </div>
      ) : view === "shelves" ? (
        <GroceryShelves
          items={shelfItems}
          checked={checked}
          onBuy={toggleBought}
          prices={prices}
          selectedStoreId={selectedStoreId}
        />
      ) : (
        <div className="space-y-5">
          {listGroups.map((loc) => (
            <div key={loc.key}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                <span className="text-sm">{loc.icon}</span>
                {loc.label}
                <span className="font-normal normal-case text-faint">
                  {loc.left === 0
                    ? "all picked up"
                    : `${loc.left} to buy`}
                  {loc.cost > 0 && ` · ${fmtMoney(loc.cost)}`}
                </span>
              </h2>
              <div className="overflow-hidden rounded-2xl card">
                {loc.types.map((type) => (
                  <div key={type.key}>
                    {/* The aisle this part of the list comes from */}
                    <div className="flex items-center gap-1.5 border-b border-line-2 bg-surface px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      <span className="text-xs">{type.emoji}</span>
                      {type.label}
                      <span className="font-normal text-faint">· {type.items.length}</span>
                    </div>
                    {type.items.map((item) => {
                      const f = item.food;
                      const isChecked = Boolean(checked[f.id]);
                      const lineCals = Math.round(item.buy * f.caloriesPerUnit);
                      const lineCost = quantityCost(f.id, item.buy, prices, selectedStoreId);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 border-b border-line-2 px-4 py-3 last:border-0"
                        >
                          <button
                            onClick={() => toggleBought(item)}
                            aria-pressed={isChecked}
                            aria-label={`${isChecked ? "Undo buying" : "Buy"} ${f.name}`}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              isChecked ? "border-accent bg-accent text-on-accent" : "border-line-2"
                            }`}
                          >
                            {isChecked && <Check size={14} />}
                          </button>
                          <div className={`flex-1 ${isChecked ? "text-muted line-through" : ""}`}>
                            <div>{f.emoji} {f.name}</div>
                            <div className="text-[11px] text-muted no-underline">
                              {lineCals} cal
                              {lineCost != null ? (
                                <span className="ml-2 text-accent-soft">{fmtMoney(lineCost)}</span>
                              ) : (
                                <span className="ml-2 text-warn-soft">no price</span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-sm text-muted">
                            buy {fmtQty(Math.ceil(item.buy * 4) / 4)} {pluralUnit(item.buy, f.unit)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted">
          Costed at <span className="text-ink-2">{storeName}</span> —{" "}
          <Link href="/stores" className="text-accent-soft hover:underline">change store</Link>
          {" or "}
          <Link href="/costs" className="text-accent-soft hover:underline">edit prices</Link>.
        </p>
      )}

      {adding && <AddFoodModal context="grocery" onClose={() => setAdding(false)} />}
    </div>
  );
}
