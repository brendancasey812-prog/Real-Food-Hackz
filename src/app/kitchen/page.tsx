"use client";

import { useState } from "react";
import { Minus, Plus, ScanLine, Menu, Pencil, Calculator, X, ChevronDown } from "lucide-react";
import { useApp, neededQuantities } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { fmtQty, unitLabel, pluralUnit, stepFor } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { AddFoodModal } from "@/components/AddFoodModal";
import { ScanReceiptModal } from "@/components/ScanReceiptModal";
import { ConversionsModal } from "@/components/ConversionsModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import type { Food, Location, Unit } from "@/lib/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Fridge } from "@/components/Fridge";

const SECTIONS: { key: Location; title: string; icon: string; tint: string }[] = [
  { key: "fridge", title: "Fridge", icon: "🧊", tint: "from-tint-fridge to-transparent" },
  { key: "freezer", title: "Freezer", icon: "❄️", tint: "from-tint-freezer to-transparent" },
  { key: "pantry", title: "Pantry", icon: "🫙", tint: "from-tint-pantry to-transparent" },
];

export default function Kitchen() {
  const { foods, inventory, recipes, plan, setInventory, updateFood, removeFood } = useApp();
  const [adding, setAdding] = useState<Location | null>(null);
  const [scanning, setScanning] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState<Set<Location>>(new Set());
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [locFilter, setLocFilter] = useState("all");
  // The fridge is the front door; the list stays a tap away for bulk editing.
  const [view, setView] = useState<"fridge" | "list">("fridge");
  const q = search.trim().toLowerCase();

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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Food Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            {view === "fridge"
              ? "Open a shelf to see what's in it · tap a food to set how much you have."
              : "Grouped by food type · drag a slider or type to set amounts."}
          </p>
        </div>
        {/* Hamburger menu + settings (top-right) */}
        <div className="flex shrink-0 items-start gap-2">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep px-4 text-sm font-medium text-on-accent shadow-lg hover:brightness-110"
          >
            <Menu size={18} /> Menu
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-page p-1 shadow-2xl">
                {menuItems.map((it) => (
                  <button key={it.label} onClick={() => { it.run(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                    <it.icon size={16} className="text-accent-soft" /> {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <SettingsButton className="hidden md:flex" />
        </div>
      </header>

      {editMode && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger-soft">
          <span>Editing — tap the <span className="font-semibold">✕</span> on any item to delete it.</span>
          <button onClick={() => setEditMode(false)} className="rounded-lg bg-danger px-3 py-1 text-xs font-medium text-on-accent hover:brightness-110">Done</button>
        </div>
      )}

      <div className="mb-4 flex w-fit rounded-xl border border-line bg-surface p-0.5 text-sm">
        {([["fridge", "Fridge"], ["list", "List"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${
              view === k
                ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "fridge" && <Fridge />}

      {view === "list" && (
      <>
      <SearchFilterBar
        query={search}
        onQuery={setSearch}
        placeholder="Search foods…"
        value={locFilter}
        onValue={setLocFilter}
        options={[{ value: "all", label: "All locations" }, ...SECTIONS.map((s) => ({ value: s.key, label: s.title }))]}
      />

      <div className="space-y-6">
        {SECTIONS.filter((section) => locFilter === "all" || section.key === locFilter).map((section) => {
          const sectionFoods = foods.filter((f) => f.location === section.key && (q ? f.name.toLowerCase().includes(q) : true));
          if (q && sectionFoods.length === 0) return null;
          const collapsed = !q && hidden.has(section.key);
          return (
            <section key={section.key} className={`rounded-2xl border border-line bg-gradient-to-b p-5 ${section.tint}`}>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="text-xl">{section.icon}</span> {section.title}
                  <span className="text-xs font-normal text-muted">· {sectionFoods.length}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAdding(section.key)} className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3">
                    <Plus size={13} /> Add
                  </button>
                  <button onClick={() => toggleHidden(section.key)} aria-label={collapsed ? "Show section" : "Hide section"} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:bg-surface-3">
                    {collapsed ? <Plus size={14} /> : <Minus size={14} />}
                  </button>
                </div>
              </div>

              {!collapsed && (
                sectionFoods.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">Nothing here yet — Menu → Add food.</p>
                ) : (
                  <div className="mt-4 space-y-5">
                    {FOOD_CATEGORIES.map((cat) => {
                      const catFoods = sectionFoods.filter((f) => f.category === cat.key);
                      if (catFoods.length === 0) return null;
                      const catKey = `${section.key}:${cat.key}`;
                      const catCollapsed = !q && collapsedCats.has(catKey);
                      return (
                        <div key={cat.key}>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                              <span>{cat.emoji}</span> {cat.label}
                              <span className="font-normal text-faint">· {catFoods.length}</span>
                            </h3>
                            <button
                              onClick={() => toggleCat(catKey)}
                              aria-label={catCollapsed ? `Show ${cat.label}` : `Hide ${cat.label}`}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-muted hover:bg-surface-3 hover:text-ink"
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
                                  onNutrition={(patch) => updateFood(f.id, patch)}
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
      </>
      )}

      {adding && <AddFoodModal context="kitchen" defaultLocation={adding} onClose={() => setAdding(null)} />}
      {scanning && <ScanReceiptModal onClose={() => setScanning(false)} />}
      {convOpen && <ConversionsModal onClose={() => setConvOpen(false)} />}
    </div>
  );
}

const SLIDER_MAX: Record<Unit, number> = { each: 12, cup: 12, tbsp: 32, tsp: 48, oz: 48 };

function FoodTile({
  food: f, have, need, editMode, onChange, onNutrition, onDelete,
}: {
  food: Food;
  have: number;
  need: number;
  editMode: boolean;
  onChange: (q: number) => void;
  onNutrition: (patch: Partial<Food>) => void;
  onDelete: () => void;
}) {
  const willUse = Math.min(need, have);
  const shortfall = Math.max(0, need - have);
  const low = have - willUse <= 0 && need > 0;
  const onHandCals = Math.round(have * f.caloriesPerUnit);
  const step = stepFor(f.unit);
  const sliderMax = Math.max(SLIDER_MAX[f.unit], Math.ceil(have * 1.5), Math.ceil(need * 1.5), step);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editNutrition, setEditNutrition] = useState(false);

  return (
    <div className="relative rounded-xl card p-3">
      {editMode && (
        <button onClick={() => setConfirmDel(true)} aria-label={`Delete ${f.name}`} className="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-on-accent shadow-lg hover:brightness-110">
          <X size={13} />
        </button>
      )}
      {confirmDel && (
        <ConfirmDialog
          title="Delete food?"
          message={`“${f.name}” will be removed from your kitchen, recipes, and grocery list. This can’t be undone.`}
          confirmLabel="Delete food"
          onConfirm={() => { setConfirmDel(false); onDelete(); }}
          onCancel={() => setConfirmDel(false)}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="text-lg">{f.emoji}</span>
          <span className="truncate">{f.name}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onChange(have - step)} className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-muted hover:bg-surface-3 hover:text-ink"><Minus size={12} /></button>
          <input
            type="number"
            value={have}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-14 rounded-md field px-1.5 py-1 text-center text-sm"
            aria-label={`${f.name} quantity`}
          />
          <button onClick={() => onChange(have + step)} className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-muted hover:bg-surface-3 hover:text-ink"><Plus size={12} /></button>
        </div>
      </div>

      {/* Editable per-unit nutrition */}
      <button
        onClick={() => setEditNutrition((v) => !v)}
        className="mt-1.5 flex w-full items-center gap-1 text-left text-[11px] text-muted hover:text-ink"
      >
        <span className="font-medium text-accent-soft">{f.caloriesPerUnit}</span> cal / {unitLabel(f.unit)} · {onHandCals} cal on hand
        <ChevronDown size={12} className={`ml-auto text-muted transition-transform ${editNutrition ? "rotate-180" : ""}`} />
      </button>

      {editNutrition && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-2 text-[11px]">
          <label className="col-span-2 flex items-center justify-between gap-2">
            <span className="text-muted">Calories / {unitLabel(f.unit)}</span>
            <input type="number" min={0} value={f.caloriesPerUnit}
              onChange={(e) => onNutrition({ caloriesPerUnit: Math.max(0, Number(e.target.value) || 0) })}
              className="w-20 rounded-md field px-2 py-1 text-right" />
          </label>
          <label className="flex items-center justify-between gap-1">
            <span className="text-protein-soft">P g</span>
            <input type="number" min={0} value={f.protein}
              onChange={(e) => onNutrition({ protein: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded-md field px-2 py-1 text-right" />
          </label>
          <label className="flex items-center justify-between gap-1">
            <span className="text-carbs-soft">C g</span>
            <input type="number" min={0} value={f.carbs}
              onChange={(e) => onNutrition({ carbs: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded-md field px-2 py-1 text-right" />
          </label>
          <label className="col-span-2 flex items-center justify-between gap-1">
            <span className="text-fat-soft">F g</span>
            <input type="number" min={0} value={f.fat}
              onChange={(e) => onNutrition({ fat: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded-md field px-2 py-1 text-right" />
          </label>
          <p className="col-span-2 text-[10px] leading-4 text-muted">Per {unitLabel(f.unit)}. Updates calories in the cookbook &amp; planner instantly.</p>
        </div>
      )}

      {/* Interactive slider — drag to change quantity */}
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={step}
        value={Math.min(have, sliderMax)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2.5 h-1.5 w-full cursor-pointer accent-accent"
        aria-label={`${f.name} slider`}
      />

      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-muted">{fmtQty(have)} {pluralUnit(have, f.unit)} on hand</span>
        {low ? (
          <span className="font-medium text-warn-soft">short {fmtQty(shortfall)} {pluralUnit(shortfall, f.unit)}</span>
        ) : willUse > 0 ? (
          <span className="text-muted">uses {fmtQty(willUse)} {pluralUnit(willUse, f.unit)}</span>
        ) : (
          <span className="text-faint">unused</span>
        )}
      </div>
    </div>
  );
}
