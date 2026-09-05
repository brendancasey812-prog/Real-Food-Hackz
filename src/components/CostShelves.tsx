"use client";

import { useState } from "react";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import { unitLabel } from "@/lib/units";
import { BASE_STORE_ID, priceFor } from "@/lib/cost";
import { Appliance, Shelf, TileGrid, AppTile, CATEGORY_TINT } from "./shelf";
import { PriceSheet } from "./PriceSheet";
import type { Food, FoodCategory, Price } from "@/lib/types";

/**
 * The cost repository as fridge shelves. Each icon badges its price, so an
 * unpriced ingredient is visible at a glance instead of being a blank field
 * somewhere down a long table.
 */
export function CostShelves({
  foods, prices, storeId, storeName, onSet,
}: {
  foods: Food[];
  prices: Price[];
  storeId: string;
  storeName: string;
  onSet: (foodId: string, pricePerUnit: number | null) => void;
}) {
  const [open, setOpen] = useState<FoodCategory | "closed" | null>(null);
  const [editing, setEditing] = useState<Food | null>(null);

  const groups = FOOD_CATEGORIES.map((c) => ({
    ...c,
    foods: foods
      .filter((f) => f.category === c.key)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.foods.length > 0);

  const isOpen = (key: FoodCategory) =>
    open === null ? key === groups[0]?.key : open === key;

  return (
    <>
      <Appliance>
        {groups.map((g) => {
          const priced = g.foods.filter(
            (f) => priceFor(prices, storeId, f.id) !== null,
          ).length;
          return (
            <Shelf
              key={g.key}
              emoji={g.emoji}
              title={g.label}
              subtitle={`${priced} of ${g.foods.length} priced`}
              open={isOpen(g.key)}
              onToggle={() => setOpen(isOpen(g.key) ? "closed" : g.key)}
            >
              <TileGrid>
                {g.foods.map((f) => {
                  const effective = priceFor(prices, storeId, f.id);
                  const fromBase = effective?.source === "base" && storeId !== BASE_STORE_ID;
                  return (
                    <AppTile
                      key={f.id}
                      emoji={f.emoji}
                      name={f.name}
                      tint={CATEGORY_TINT[f.category]}
                      dimmed={!effective}
                      onClick={() => setEditing(f)}
                      ariaLabel={`Set the price of ${f.name}`}
                      badge={effective ? effective.pricePerUnit.toFixed(2) : "—"}
                      badgeTone={!effective ? "muted" : fromBase ? "muted" : "accent"}
                      sub={
                        effective ? (
                          <>
                            / {unitLabel(f.unit)}
                            {fromBase && <span className="block text-sea-soft">base price</span>}
                          </>
                        ) : (
                          <span className="text-warn-soft">no price</span>
                        )
                      }
                    />
                  );
                })}
              </TileGrid>
            </Shelf>
          );
        })}
      </Appliance>

      {editing && (
        <PriceSheet
          food={editing}
          prices={prices}
          storeId={storeId}
          storeName={storeName}
          onSet={(v) => onSet(editing.id, v)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
