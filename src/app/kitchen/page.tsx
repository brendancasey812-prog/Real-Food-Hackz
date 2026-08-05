"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useApp, neededQuantities } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { fmtQty, unitLabel, pluralUnit, stepFor } from "@/lib/units";
import { AddFoodModal } from "@/components/AddFoodModal";
import type { Location } from "@/lib/types";

const SECTIONS: { key: Location; title: string; icon: string; tint: string }[] = [
  { key: "fridge", title: "Fridge", icon: "🧊", tint: "from-sky-50 to-white dark:from-sky-950/30 dark:to-zinc-900" },
  { key: "freezer", title: "Freezer", icon: "❄️", tint: "from-cyan-50 to-white dark:from-cyan-950/30 dark:to-zinc-900" },
  { key: "pantry", title: "Pantry", icon: "🫙", tint: "from-amber-50 to-white dark:from-amber-950/30 dark:to-zinc-900" },
];

export default function Kitchen() {
  const { foods, inventory, recipes, plan, setInventory } = useApp();
  const [adding, setAdding] = useState<Location | null>(null);

  const days = weekDays(new Date()).map(isoOf);
  const need = neededQuantities(
    plan.filter((m) => days.includes(m.date)),
    recipes,
  );

  const qtyOf = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your kitchen</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live stock in US units. The shaded part of each bar is what this week&apos;s plan will use.
          </p>
        </div>
        <button
          onClick={() => setAdding("fridge")}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> Add food
        </button>
      </header>

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const sectionFoods = foods.filter((f) => f.location === section.key);
          return (
            <section
              key={section.key}
              className={`rounded-2xl border border-zinc-200 bg-gradient-to-b p-5 dark:border-zinc-800 ${section.tint}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="text-xl">{section.icon}</span> {section.title}
                </h2>
                <button
                  onClick={() => setAdding(section.key)}
                  className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              {sectionFoods.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-400">
                  Nothing here yet — tap “Add”.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionFoods.map((f) => {
                    const have = qtyOf(f.id);
                    const willUse = Math.min(need[f.id] ?? 0, have);
                    const shortfall = Math.max(0, (need[f.id] ?? 0) - have);
                    const capacity = Math.max(have, need[f.id] ?? 0, 1);
                    const remainPct = ((have - willUse) / capacity) * 100;
                    const usePct = (willUse / capacity) * 100;
                    const low = have - willUse <= 0 && (need[f.id] ?? 0) > 0;
                    const onHandCals = Math.round(have * f.caloriesPerUnit);

                    return (
                      <div
                        key={f.id}
                        className="rounded-xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="text-lg">{f.emoji}</span>
                            {f.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setInventory(f.id, have - stepFor(f.unit))}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              <Minus size={12} />
                            </button>
                            <button
                              onClick={() => setInventory(f.id, have + stepFor(f.unit))}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Per-unit calorie badge */}
                        <div className="mt-1.5 text-[11px] text-zinc-400">
                          {f.caloriesPerUnit} cal / {unitLabel(f.unit)} · {onHandCals} cal on hand
                        </div>

                        {/* Two-segment level bar: remaining + will-be-used */}
                        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full bg-emerald-500" style={{ width: `${remainPct}%` }} />
                          <div className="h-full bg-amber-400" style={{ width: `${usePct}%` }} />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            {fmtQty(have)} {pluralUnit(have, f.unit)} on hand
                          </span>
                          {low ? (
                            <span className="font-medium text-rose-500">
                              short {fmtQty(shortfall)} {pluralUnit(shortfall, f.unit)}
                            </span>
                          ) : willUse > 0 ? (
                            <span className="text-amber-600">
                              uses {fmtQty(willUse)} {pluralUnit(willUse, f.unit)}
                            </span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">unused</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {adding && (
        <AddFoodModal
          context="kitchen"
          defaultLocation={adding}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}
