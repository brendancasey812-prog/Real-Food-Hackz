"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChefHat, ListChecks } from "lucide-react";
import { useApp, neededQuantities } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { FoodShelves } from "./FoodShelves";
import { RecipeBuilderSheet } from "./RecipeBuilderSheet";
import { EditItemsSheet } from "./EditItems";

/**
 * The Food Tracker's shelves: the shared browser showing what you have, plus
 * the one thing only this tab does — picking ingredients off the shelf and
 * turning them into a recipe.
 */
export function Fridge() {
  const { foods, inventory, recipes, plan } = useApp();

  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState(false);

  // What this week's plan still needs, so a short food can say so on its tile.
  const days = weekDays(new Date()).map(isoOf);
  const need = neededQuantities(plan.filter((m) => days.includes(m.date)), recipes);
  const buyOf = (id: string) => {
    const have = inventory.find((i) => i.foodId === id)?.quantity ?? 0;
    return Math.max(0, (need[id] ?? 0) - have);
  };

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

  return (
    <>
      {picking && (
        <p className="mb-3 rounded-xl border border-accent bg-accent-wash px-4 py-2.5 text-sm text-accent-soft">
          Tap the foods you want to cook with, then build a recipe from them.
        </p>
      )}

      <FoodShelves
        mode="stock"
        foods={foods}
        buyOf={buyOf}
        picking={picking}
        chosen={chosen}
        onPick={toggleChosen}
        extraControl={
          <>
            {/* The whole catalogue, for renaming and deleting in one sitting */}
            <button
              onClick={() => setEditingItems(true)}
              title="Rename, move or delete any food"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-3"
            >
              <ListChecks size={16} />
              <span className="hidden sm:inline">Edit items</span>
            </button>
            <Switch
              on={picking}
              onChange={(v) => (v ? setPicking(true) : stopPicking())}
              label="Pick ingredients"
            />
          </>
        }
      />

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

/** An iOS-style toggle. */
function Switch({
  on, onChange, label
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
