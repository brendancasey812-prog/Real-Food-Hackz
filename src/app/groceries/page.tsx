"use client";

import { useState } from "react";
import Link from "next/link";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Share } from "lucide-react";
import { useApp, neededQuantities, foodById } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { AddFoodModal } from "@/components/AddFoodModal";
import type { Food } from "@/lib/types";
import { BASE_STORE_ID, quantityCost } from "@/lib/cost";
import { SettingsButton } from "@/components/SettingsButton";
import { FoodShelves } from "@/components/FoodShelves";
import { ExportSheet } from "@/components/ExportSheet";
import { groceryText, groceryCsv, exportName } from "@/lib/exportfile";

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
  const [exporting, setExporting] = useState(false);

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

  // What an export sees: the list as it stands, priced at the current store.
  const exportLines = () =>
    shelfItems
      .map((i) => ({
        food: i.food,
        buy: i.buy,
        cost: quantityCost(i.food.id, i.buy, prices, selectedStoreId),
      }))
      .sort((a, b) => a.food.name.localeCompare(b.food.name));

  const toggleBought = (item: { food: Food; buy: number; have: number }) =>
    checked[item.food.id]
      ? undoBought(item.food.id)
      : markBought(item.food.id, item.have, item.buy);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Grocery list</h1>
          <p className="mt-1 text-sm text-muted">
            Auto-built from your plan minus what&apos;s in the kitchen
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setExporting(true)}
            disabled={shelfItems.length === 0}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3 disabled:opacity-40"
          >
            <Share size={16} /> Export
          </button>
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
        </div>
      </div>

      {shelfItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 py-16 text-center text-sm text-muted">
          Your kitchen already has everything for this week&apos;s plan.
        </div>
      ) : (
        <FoodShelves
          mode="shop"
          foods={shelfItems.map((i) => i.food)}
          buyOf={(id) => shelfItems.find((i) => i.food.id === id)?.buy ?? 0}
          checked={checked}
          onTick={(f) => {
            const item = shelfItems.find((i) => i.food.id === f.id);
            if (item) toggleBought(item);
          }}
        />
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

      {exporting && (
        <ExportSheet
          title="Export grocery list"
          subtitle={`Week of ${format(weekDays(addWeeks(new Date(), offset))[0], "MMM d")} · ${shelfItems.length} items`}
          onClose={() => setExporting(false)}
          filenameFor={(f) => exportName("groceries", weekDays(addWeeks(new Date(), offset))[0], f.ext)}
          formats={[
            {
              key: "text", label: "Checklist", ext: "txt", mime: "text/plain",
              hint: "A tick-box list grouped by aisle — paste it into a message or print it.",
              build: () => groceryText(exportLines(), weekDays(addWeeks(new Date(), offset))[0]),
            },
            {
              key: "csv", label: "Spreadsheet", ext: "csv", mime: "text/csv",
              hint: "One row per item, with quantity, cost and calories.",
              build: () => groceryCsv(exportLines()),
            },
          ]}
        />
      )}
    </div>
  );
}
