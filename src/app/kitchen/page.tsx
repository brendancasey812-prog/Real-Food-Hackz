"use client";

import { useState } from "react";
import { Minus, Plus, ScanLine, Menu, Pencil, Calculator, X } from "lucide-react";
import { useApp, neededQuantities } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { fmtQty, unitLabel, pluralUnit, stepFor } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { AddFoodModal } from "@/components/AddFoodModal";
import { ScanReceiptModal } from "@/components/ScanReceiptModal";
import { ConversionsModal } from "@/components/ConversionsModal";
import type { Food, Location, Unit } from "@/lib/types";

const SECTIONS: { key: Location; title: string; icon: string; tint: string }[] = [
  { key: "fridge", title: "Fridge", icon: "🧊", tint: "from-sky-50 to-white dark:from-sky-950/30 dark:to-zinc-900" },
  { key: "freezer", title: "Freezer", icon: "❄️", tint: "from-cyan-50 to-white dark:from-cyan-950/30 dark:to-zinc-900" },
  { key: "pantry", title: "Pantry", icon: "🫙", tint: "from-amber-50 to-white dark:from-amber-950/30 dark:to-zinc-900" },
];

export default function Kitchen() {
  const { foods, inventory, recipes, plan, setInventory, removeFood } = useApp();
  const [adding, setAdding] = useState<Location | null>(null);
  const [scanning, setScanning] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState<Set<Location>>(new Set());
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const days = weekDays(new Date()).map(isoOf);
  const need = neededQuantities(plan.filter((m) => days.includes(m.date)), recipes);
  const qtyOf = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;
  const toggleHidden = (k: Location) => setHidden((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleCat = (key: string) => setCollapsedCats((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const menuItems = [
    { label: "Add food", icon: Plus, run: () => setAdding("fridge") },
    { label: "Scan receipt", icon: ScanLine, run: () => setScanning(true) },
    { label: editMode ? "Done editing" : "Edit (delete items)", icon: Pencil, run: () => setEditMode((v) => !v) },
    { label: "Conversions chart", icon: Calculator, run: () => setConvOpen(true) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your kitchen</h1>
          <p className="mt-1 text-sm text-zinc-500">Grouped by food type · drag a slider or type to set amounts.</p>
        </div>
        {/* Hamburger menu (top-right) */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110"
          >
            <Menu size={18} /> Menu
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-2xl">
                {menuItems.map((it) => (
                  <button key={it.label} onClick={() => { it.run(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-emerald-500/10">
                    <it.icon size={16} className="text-emerald-400" /> {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {editMode && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
          <span>Editing — tap the <span className="font-semibold">✕</span> on any item to delete it.</span>
          <button onClick={() => setEditMode(false)} className="rounded-lg bg-rose-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-rose-600">Done</button>
        </div>
      )}

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const sectionFoods = foods.filter((f) => f.location === section.key);
          const collapsed = hidden.has(section.key);
          return (
            <section key={section.key} className={`rounded-2xl border border-white/10 bg-gradient-to-b p-5 ${section.tint}`}>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="text-xl">{section.icon}</span> {section.title}
                  <span className="text-xs font-normal text-zinc-500">· {sectionFoods.length}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAdding(section.key)} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.08]">
                    <Plus size={13} /> Add
                  </button>
                  <button onClick={() => toggleHidden(section.key)} aria-label={collapsed ? "Show section" : "Hide section"} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]">
                    {collapsed ? <Plus size={14} /> : <Minus size={14} />}
                  </button>
                </div>
              </div>

              {!collapsed && (
                sectionFoods.length === 0 ? (
                  <p className="py-4 text-center text-sm text-zinc-400">Nothing here yet — Menu → Add food.</p>
                ) : (
                  <div className="mt-4 space-y-5">
                    {FOOD_CATEGORIES.map((cat) => {
                      const catFoods = sectionFoods.filter((f) => f.category === cat.key);
                      if (catFoods.length === 0) return null;
                      const catKey = `${section.key}:${cat.key}`;
                      const catCollapsed = collapsedCats.has(catKey);
                      return (
                        <div key={cat.key}>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                              <span>{cat.emoji}</span> {cat.label}
                              <span className="font-normal text-zinc-600">· {catFoods.length}</span>
                            </h3>
                            <button
                              onClick={() => toggleCat(catKey)}
                              aria-label={catCollapsed ? `Show ${cat.label}` : `Hide ${cat.label}`}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
                            >
                              {catCollapsed ? <Plus size={12} /> : <Minus size={12} />}
                            </button>
                          </div>
                          {!catCollapsed && (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {catFoods.map((f) => (
                                <FoodTile
                                  key={f.id}
                                  food={f}
                                  have={qtyOf(f.id)}
                                  need={need[f.id] ?? 0}
                                  editMode={editMode}
                                  onChange={(q) => setInventory(f.id, q)}
                                  onDelete={() => removeFood(f.id)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>

      {adding && <AddFoodModal context="kitchen" defaultLocation={adding} onClose={() => setAdding(null)} />}
      {scanning && <ScanReceiptModal onClose={() => setScanning(false)} />}
      {convOpen && <ConversionsModal onClose={() => setConvOpen(false)} />}
    </div>
  );
}

const SLIDER_MAX: Record<Unit, number> = { each: 12, cup: 12, tbsp: 32, tsp: 48, oz: 48 };

function FoodTile({
  food: f, have, need, editMode, onChange, onDelete,
}: {
  food: Food;
  have: number;
  need: number;
  editMode: boolean;
  onChange: (q: number) => void;
  onDelete: () => void;
}) {
  const willUse = Math.min(need, have);
  const shortfall = Math.max(0, need - have);
  const low = have - willUse <= 0 && need > 0;
  const onHandCals = Math.round(have * f.caloriesPerUnit);
  const step = stepFor(f.unit);
  const sliderMax = Math.max(SLIDER_MAX[f.unit], Math.ceil(have * 1.5), Math.ceil(need * 1.5), step);

  return (
    <div className="relative rounded-xl card p-3">
      {editMode && (
        <button onClick={onDelete} aria-label={`Delete ${f.name}`} className="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-500">
          <X size={13} />
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="text-lg">{f.emoji}</span>
          <span className="truncate">{f.name}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onChange(have - step)} className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"><Minus size={12} /></button>
          <input
            type="number"
            value={have}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-14 rounded-md field px-1.5 py-1 text-center text-sm"
            aria-label={`${f.name} quantity`}
          />
          <button onClick={() => onChange(have + step)} className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"><Plus size={12} /></button>
        </div>
      </div>

      <div className="mt-1.5 text-[11px] text-zinc-400">
        {f.caloriesPerUnit} cal / {unitLabel(f.unit)} · {onHandCals} cal on hand
      </div>

      {/* Interactive slider — drag to change quantity */}
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={step}
        value={Math.min(have, sliderMax)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2.5 h-1.5 w-full cursor-pointer accent-emerald-500"
        aria-label={`${f.name} slider`}
      />

      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-500">{fmtQty(have)} {pluralUnit(have, f.unit)} on hand</span>
        {low ? (
          <span className="font-medium text-rose-500">short {fmtQty(shortfall)} {pluralUnit(shortfall, f.unit)}</span>
        ) : willUse > 0 ? (
          <span className="text-amber-400">uses {fmtQty(willUse)} {pluralUnit(willUse, f.unit)}</span>
        ) : (
          <span className="text-zinc-600">unused</span>
        )}
      </div>
    </div>
  );
}
