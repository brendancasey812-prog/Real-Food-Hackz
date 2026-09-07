"use client";

import { useApp, neededQuantities } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { FoodShelves } from "./FoodShelves";

/**
 * The Food Tracker's shelves: the shared browser, showing what you have and
 * what this week's plan will run you short of.
 */
export function Fridge() {
  const { foods, inventory, recipes, plan } = useApp();

  // What this week's plan still needs, so a short food can say so on its tile.
  const days = weekDays(new Date()).map(isoOf);
  const need = neededQuantities(plan.filter((m) => days.includes(m.date)), recipes);
  const buyOf = (id: string) => {
    const have = inventory.find((i) => i.foodId === id)?.quantity ?? 0;
    return Math.max(0, (need[id] ?? 0) - have);
  };

  return <FoodShelves mode="stock" foods={foods} buyOf={buyOf} />;
}
