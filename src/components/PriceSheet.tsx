"use client";

import { useEffect } from "react";
import { X, RotateCcw } from "lucide-react";
import { unitLabel } from "@/lib/units";
import { FOOD_CATEGORY_LABEL } from "@/lib/foodcat";
import { BASE_STORE_ID, fmtMoney, priceFor } from "@/lib/cost";
import type { Food, Price } from "@/lib/types";

/**
 * Tapping a food in the Costs tab opens this — the counterpart to the fridge's
 * food sheet, but for what it costs rather than how much you have.
 */
export function PriceSheet({
  food: f, prices, storeId, storeName, onSet, onClose,
}: {
  food: Food;
  prices: Price[];
  storeId: string;
  storeName: string;
  onSet: (pricePerUnit: number | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const own = prices.find((p) => p.storeId === storeId && p.foodId === f.id);
  const effective = priceFor(prices, storeId, f.id);
  const usingBase = effective?.source === "base" && storeId !== BASE_STORE_ID;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-page p-5 pb-8 md:rounded-3xl md:pb-5"
      >
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line-2 md:hidden" />

        <div className="flex items-start gap-4">
          <span className="squircle flex h-16 w-16 shrink-0 items-center justify-center bg-gradient-to-br from-accent/25 to-accent/10 text-[30px] ring-1 ring-accent/20">
            {f.emoji}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="truncate text-lg font-semibold text-ink">{f.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {FOOD_CATEGORY_LABEL[f.category]} · {f.caloriesPerUnit} cal / {unitLabel(f.unit)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Price at {storeName}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-2xl text-muted">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              autoFocus
              value={own ? own.pricePerUnit : ""}
              placeholder={usingBase ? effective.pricePerUnit.toFixed(2) : "0.00"}
              onChange={(e) => onSet(e.target.value === "" ? null : Number(e.target.value))}
              aria-label={`Price per ${unitLabel(f.unit)} of ${f.name}`}
              className="field w-32 rounded-xl px-3 py-1.5 text-center text-2xl font-semibold tabular-nums"
            />
            <span className="text-sm text-muted">/ {unitLabel(f.unit)}</span>
          </div>

          <p className="mt-3 text-center text-[11px] leading-4 text-muted">
            {own ? (
              <>Set for this store.</>
            ) : usingBase ? (
              <>
                Falling back to your base price of{" "}
                <span className="text-ink-2">{fmtMoney(effective.pricePerUnit)}</span> / {unitLabel(f.unit)}.
                Type a number to override it here.
              </>
            ) : (
              <>No price yet — anything costed with this food will say so.</>
            )}
          </p>

          {own && (
            <button
              onClick={() => onSet(null)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2 text-xs font-medium text-muted transition-colors hover:bg-danger/10 hover:text-danger-soft"
            >
              <RotateCcw size={13} /> Clear this store&apos;s price
            </button>
          )}
        </div>

        <button onClick={onClose} className="btn-accent mt-4 w-full rounded-xl py-3 text-sm">
          Done
        </button>
      </div>
    </div>
  );
}
