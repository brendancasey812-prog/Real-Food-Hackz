"use client";

import { useState } from "react";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useApp, neededQuantities, foodById } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";

export default function Groceries() {
  const { recipes, foods, plan, inventory, setInventory } = useApp();
  const [offset, setOffset] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const days = weekDays(addWeeks(new Date(), offset)).map(isoOf);
  const need = neededQuantities(
    plan.filter((m) => days.includes(m.date)),
    recipes,
  );

  const items = Object.entries(need)
    .map(([foodId, qty]) => {
      const have = inventory.find((i) => i.foodId === foodId)?.quantity ?? 0;
      const food = foodById(foods, foodId);
      return { food, need: qty, have, buy: Math.max(0, qty - have) };
    })
    .filter((x) => x.food && x.buy > 0.01)
    .sort((a, b) => (a.food!.location > b.food!.location ? 1 : -1));

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const loc = item.food!.location;
    (acc[loc] ??= []).push(item);
    return acc;
  }, {});

  const markBought = (foodId: string, total: number) => {
    setInventory(foodId, total);
    setChecked((c) => ({ ...c, [foodId]: true }));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Grocery list</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Auto-built from your plan minus what&apos;s in the kitchen
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
            <ChevronLeft size={16} />
          </button>
          <span className="px-1 text-sm text-zinc-500">
            {format(weekDays(addWeeks(new Date(), offset))[0], "MMM d")}
          </span>
          <button onClick={() => setOffset((o) => o + 1)} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-400 dark:border-zinc-700">
          🎉 Your kitchen already has everything for this week&apos;s plan.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([loc, list]) => (
            <div key={loc}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {loc}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {list.map((item) => {
                  const isChecked = checked[item.food!.id];
                  return (
                    <div
                      key={item.food!.id}
                      className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800"
                    >
                      <button
                        onClick={() => markBought(item.food!.id, item.need)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}
                      >
                        {isChecked && <Check size={14} />}
                      </button>
                      <span className={`flex-1 ${isChecked ? "text-zinc-400 line-through" : ""}`}>
                        {item.food!.emoji} {item.food!.name}
                      </span>
                      <span className="text-sm text-zinc-500">
                        buy {Math.ceil(item.buy)} {item.food!.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
