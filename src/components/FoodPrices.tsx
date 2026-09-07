"use client";

import { RotateCcw, Check } from "lucide-react";
import { useApp } from "@/lib/store";
import { unitLabel } from "@/lib/units";
import { fmtMoney, pricesForFood, BASE_STORE_ID } from "@/lib/cost";
import type { Food } from "@/lib/types";

/**
 * What one food costs at every shop you use.
 *
 * Prices were only ever editable one store at a time, through whichever store
 * the app happened to be costing against — so recording that Berkeley Bowl is
 * cheaper than Safeway meant switching stores, typing, and switching back, and
 * you could never see the two numbers together. Here they are all at once,
 * each editable, with the cheapest marked, because the comparison is the
 * whole point of keeping more than one.
 */
export function FoodPrices({ food }: { food: Food }) {
  const { stores, prices, setPrice } = useApp();

  const rows = [
    { id: BASE_STORE_ID, name: "Base price", hint: "typical, used when a shop has none" },
    ...stores.map((s) => ({ id: s.id, name: s.name, hint: s.city || "" })),
  ].map((row) => ({
    ...row,
    price: prices.find((p) => p.storeId === row.id && p.foodId === food.id) ?? null,
  }));

  // The number the app will actually cost with: cheapest real shop, else base.
  const cheapest = pricesForFood(prices, food.id).filter((p) => p.storeId !== BASE_STORE_ID)[0]
    ?? pricesForFood(prices, food.id)[0]
    ?? null;

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Price per {unitLabel(food.unit)}
        </p>
        {cheapest && (
          <p className="text-[11px] text-accent-soft">
            cheapest {fmtMoney(cheapest.pricePerUnit)}
          </p>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map((row) => {
          const isCheapest = cheapest != null && row.price != null &&
            row.price.pricePerUnit === cheapest.pricePerUnit && row.id === cheapest.storeId;
          return (
            <div key={row.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                {row.name}
                {isCheapest && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-accent-soft">
                    <Check size={10} /> cheapest
                  </span>
                )}
                {row.hint && !isCheapest && (
                  <span className="ml-1.5 text-[10px] text-faint">{row.hint}</span>
                )}
              </span>

              <span className="text-muted">$</span>
              <input
                type="number" min={0} step={0.01} inputMode="decimal"
                value={row.price ? row.price.pricePerUnit : ""}
                placeholder="0.00"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setPrice(row.id, food.id, v === "" ? null : Math.max(0, Number(v) || 0));
                }}
                aria-label={`Price of ${food.name} at ${row.name}`}
                className={`field w-20 rounded-lg px-2 py-1 text-right text-sm tabular-nums ${
                  isCheapest ? "ring-1 ring-accent" : ""
                }`}
              />
              <button
                onClick={() => setPrice(row.id, food.id, null)}
                disabled={!row.price}
                title={row.price ? `Clear the ${row.name} price` : "No price here"}
                className="rounded-lg p-1 text-faint enabled:hover:bg-surface-3 enabled:hover:text-ink-2 disabled:opacity-25"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {stores.length === 0 && (
        <p className="mt-2 text-[11px] leading-4 text-muted">
          Add a store on the Stores tab and its own price for this food appears here,
          alongside the base one.
        </p>
      )}
    </div>
  );
}
