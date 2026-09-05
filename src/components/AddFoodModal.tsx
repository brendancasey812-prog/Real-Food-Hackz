"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { UNITS } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import type { FoodCategory, Location, Unit } from "@/lib/types";

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
  onClose
}: {
  context: "kitchen" | "grocery";
  defaultLocation?: Location;
  onClose: () => void;
}) {
  const { addFood, addManualGrocery } = useApp();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("each");
  const [calories, setCalories] = useState(100);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [location, setLocation] = useState<Location>(defaultLocation);
  const [category, setCategory] = useState<FoodCategory>("protein");
  const [quantity, setQuantity] = useState(1);

  const save = () => {
    if (!name.trim()) return;
    const id = newId();
    addFood(
      {
        id,
        name: name.trim(),
        unit,
        caloriesPerUnit: Math.max(0, calories),
        protein: Math.max(0, protein),
        carbs: Math.max(0, carbs),
        fat: Math.max(0, fat),
        location,
        category
      },
      context === "kitchen" ? quantity : 0,
    );
    if (context === "grocery") addManualGrocery(id, quantity);
    onClose();
  };

  const qtyLabel = context === "grocery" ? "Quantity to buy" : "Current quantity";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-scrim p-0 md:items-center md:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-page p-6 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {context === "grocery" ? "Add grocery item" : "Add food to kitchen"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink-2">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Food name (e.g. Almonds)"
              className="flex-1 rounded-lg field px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Measured in</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full rounded-lg field px-2 py-2"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Calories per {unit}</span>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full rounded-lg field px-2 py-2"
              />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-sm text-muted">Macros per {unit} (grams)</span>
            <div className="grid grid-cols-3 gap-3">
              <input type="number" value={protein} onChange={(e) => setProtein(Number(e.target.value))} placeholder="protein" className="w-full rounded-lg field px-2 py-2 text-sm" />
              <input type="number" value={carbs} onChange={(e) => setCarbs(Number(e.target.value))} placeholder="carbs" className="w-full rounded-lg field px-2 py-2 text-sm" />
              <input type="number" value={fat} onChange={(e) => setFat(Number(e.target.value))} placeholder="fat" className="w-full rounded-lg field px-2 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Stored in</span>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as Location)}
                className="w-full rounded-lg field px-2 py-2"
              >
                {LOCATIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Food type</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FoodCategory)}
                className="w-full rounded-lg field px-2 py-2"
              >
                {FOOD_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted">{qtyLabel}</span>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg field px-2 py-2"
              />
            </label>
          </div>

          <button
            onClick={save}
            className="w-full rounded-xl bg-gradient-to-b from-accent to-accent-deep shadow-lg py-3 font-medium text-on-accent hover:brightness-110"
          >
            {context === "grocery" ? "Add to grocery list" : "Add to kitchen"}
          </button>
        </div>
      </div>
    </div>
  );
}
