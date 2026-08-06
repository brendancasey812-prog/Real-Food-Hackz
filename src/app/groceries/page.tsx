"use client";

import { useState } from "react";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight, Check, Plus } from "lucide-react";
import { useApp, neededQuantities, foodById } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { fmtQty, pluralUnit } from "@/lib/units";
import { AddFoodModal } from "@/components/AddFoodModal";

export default function Groceries() {
  const { recipes, foods, plan, inventory, manualGroceries, setInventory, removeManualGrocery } = useApp();
  const [offset, setOffset] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

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

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const loc = item.food!.location;
    (acc[loc] ??= []).push(item);
    return acc;
  }, {});

  const totalCals = items.reduce(
    (s, x) => s + Math.round(x.buy * x.food!.caloriesPerUnit),
    0,
  );

  const markBought = (foodId: string, have: number, buy: number) => {
    setInventory(foodId, have + buy);
    manualGroceries.filter((m) => m.foodId === foodId).forEach((m) => removeManualGrocery(m.id));
    setChecked((c) => ({ ...c, [foodId]: true }));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Grocery list</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Auto-built from your plan minus what&apos;s in the kitchen
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-900/30 px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
        >
          <Plus size={16} /> Add item
        </button>
      </header>

      <div className="mb-4 flex items-center justify-between rounded-xl card px-4 py-2.5 text-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <ChevronLeft size={16} />
          </button>
          <span className="px-1 text-zinc-500">
            Week of {format(weekDays(addWeeks(new Date(), offset))[0], "MMM d")}
          </span>
          <button onClick={() => setOffset((o) => o + 1)} className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-zinc-400">{totalCals.toLocaleString()} cal to buy</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-sm text-zinc-400">
          🎉 Your kitchen already has everything for this week&apos;s plan.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([loc, list]) => (
            <div key={loc}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {loc}
              </h2>
              <div className="overflow-hidden rounded-2xl card">
                {list.map((item) => {
                  const f = item.food!;
                  const isChecked = checked[f.id];
                  const lineCals = Math.round(item.buy * f.caloriesPerUnit);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800"
                    >
                      <button
                        onClick={() => markBought(f.id, item.have, item.buy)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}
                      >
                        {isChecked && <Check size={14} />}
                      </button>
                      <div className={`flex-1 ${isChecked ? "text-zinc-400 line-through" : ""}`}>
                        <div>{f.emoji} {f.name}</div>
                        <div className="text-[11px] text-zinc-400">{lineCals} cal</div>
                      </div>
                      <span className="text-sm text-zinc-500">
                        buy {fmtQty(Math.ceil(item.buy * 4) / 4)} {pluralUnit(item.buy, f.unit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AddFoodModal context="grocery" onClose={() => setAdding(false)} />}
    </div>
  );
}
