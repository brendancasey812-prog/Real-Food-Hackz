"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { UNITS } from "@/lib/units";
import type { Location, Unit } from "@/lib/types";

const LOCATIONS: { value: Location; label: string }[] = [
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
  { value: "pantry", label: "Pantry" },
];

/**
 * Add a food to the catalog.
 *  - context "kitchen": the quantity is what you have on hand right now.
 *  - context "grocery": the quantity is what you want to buy (adds a shopping line).
 */
export function AddFoodModal({
  context,
  defaultLocation = "fridge",
  onClose,
}: {
  context: "kitchen" | "grocery";
  defaultLocation?: Location;
  onClose: () => void;
}) {
  const { addFood, addManualGrocery } = useApp();
  const [emoji, setEmoji] = useState("🍽️");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("each");
  const [calories, setCalories] = useState(100);
  const [location, setLocation] = useState<Location>(defaultLocation);
  const [quantity, setQuantity] = useState(context === "grocery" ? 1 : 1);

  const save = () => {
    if (!name.trim()) return;
    const id = newId();
    addFood(
      {
        id,
        name: name.trim(),
        unit,
        caloriesPerUnit: Math.max(0, calories),
        location,
        emoji: emoji || "🍽️",
      },
      context === "kitchen" ? quantity : 0,
    );
    if (context === "grocery") addManualGrocery(id, quantity);
    onClose();
  };

  const qtyLabel = context === "grocery" ? "Quantity to buy" : "Current quantity";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-zinc-900 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {context === "grocery" ? "Add grocery item" : "Add food to kitchen"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-14 rounded-lg border border-zinc-300 bg-transparent px-2 py-2 text-center text-xl dark:border-zinc-700"
            />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Food name (e.g. Almonds)"
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Measured in</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 dark:border-zinc-700"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Calories per {unit}</span>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 dark:border-zinc-700"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Stored in</span>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as Location)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 dark:border-zinc-700"
              >
                {LOCATIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">{qtyLabel}</span>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-2 dark:border-zinc-700"
              />
            </label>
          </div>

          <button
            onClick={save}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700"
          >
            {context === "grocery" ? "Add to grocery list" : "Add to kitchen"}
          </button>
        </div>
      </div>
    </div>
  );
}
