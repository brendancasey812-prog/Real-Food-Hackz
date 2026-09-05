"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { fmtQty, pluralUnit } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { fmtMoney, quantityCost } from "@/lib/cost";
import { Appliance, Shelf, TileGrid, AppTile, CATEGORY_TINT } from "./shelf";
import type { Food, FoodCategory, Price } from "@/lib/types";

export interface GroceryItem {
  food: Food;
  /** How much still needs buying. */
  buy: number;
  /** How much is already on hand. */
  have: number;
}

/**
 * The grocery list as fridge shelves: the aisles you shop, each opening onto
 * the items to pick up. Tapping an item ticks it off and stocks the kitchen —
 * the same tap the list view's checkbox does.
 */
export function GroceryShelves({
  items, checked, onBuy, prices, selectedStoreId,
}: {
  items: GroceryItem[];
  checked: Record<string, boolean>;
  onBuy: (item: GroceryItem) => void;
  prices: Price[];
  selectedStoreId: string;
}) {
  // One shelf open at a time keeps a long list walkable. `null` means "not
  // chosen yet", which opens the first shelf; "closed" means all shut.
  const [open, setOpen] = useState<FoodCategory | "closed" | null>(null);

  const groups = FOOD_CATEGORIES.map((c) => ({
    ...c,
    items: items
      .filter((i) => i.food.category === c.key)
      .sort((a, b) => a.food.name.localeCompare(b.food.name)),
  })).filter((g) => g.items.length > 0);

  // The first shelf opens by default so the tab isn't a wall of closed doors.
  const isOpen = (key: FoodCategory) =>
    open === null ? key === groups[0]?.key : open === key;

  return (
    <Appliance>
      {groups.map((g) => {
        const left = g.items.filter((i) => !checked[i.food.id]);
        const cals = g.items.reduce(
          (s, i) => s + Math.round(i.buy * i.food.caloriesPerUnit),
          0,
        );
        return (
          <Shelf
            key={g.key}
            emoji={g.emoji}
            title={g.label}
            subtitle={
              <>
                {left.length === 0
                  ? "all picked up"
                  : `${left.length} to buy${g.items.length !== left.length ? ` · ${g.items.length - left.length} done` : ""}`}
                {cals > 0 && ` · ${cals.toLocaleString()} cal`}
              </>
            }
            open={isOpen(g.key)}
            onToggle={() => setOpen(isOpen(g.key) ? "closed" : g.key)}
          >
            <TileGrid>
              {g.items.map((item) => {
                const f = item.food;
                const done = Boolean(checked[f.id]);
                const cost = quantityCost(f.id, item.buy, prices, selectedStoreId);
                // Shopping is done in whole-ish amounts, so round the ask up.
                const ask = Math.ceil(item.buy * 4) / 4;
                return (
                  <AppTile
                    key={f.id}
                    emoji={f.emoji}
                    name={f.name}
                    tint={CATEGORY_TINT[f.category]}
                    dimmed={done}
                    strike={done}
                    selected={done}
                    badge={done ? <Check size={11} strokeWidth={3} /> : fmtQty(ask)}
                    badgeTone={done ? "accent" : "accent"}
                    onClick={() => onBuy(item)}
                    ariaLabel={`${done ? "Undo buying" : "Buy"} ${fmtQty(ask)} ${pluralUnit(ask, f.unit)} of ${f.name}`}
                    sub={
                      <>
                        {fmtQty(ask)} {pluralUnit(ask, f.unit)}
                        {cost != null && (
                          <span className="block text-accent-soft">{fmtMoney(cost)}</span>
                        )}
                      </>
                    }
                  />
                );
              })}
            </TileGrid>
          </Shelf>
        );
      })}
    </Appliance>
  );
}
