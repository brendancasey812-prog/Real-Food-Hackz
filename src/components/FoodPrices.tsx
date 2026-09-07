"use client";

import { useState } from "react";
import { RotateCcw, Check } from "lucide-react";
import { useApp } from "@/lib/store";
import { unitLabel, BUY_UNITS, pricePerOwnUnit, priceInBuyUnit, pricePerBuyUnit } from "@/lib/units";
import { gramsForFood } from "@/lib/usda";
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
  const { stores, prices, setPrice, updateFood } = useApp();

  // Shops price by the pound; kitchens cook by the ounce. Entering a price
  // the way the shelf label reads and converting is the difference between a
  // right number and one divided by 16 in someone's head.
  //
  // Which one you want is kept on the food, so saying "beef is priced by the
  // pound" is said once rather than every time this panel opens.
  const grams = gramsForFood(food)?.grams ?? null;
  const usable = BUY_UNITS.filter(
    (b) =>
      b.key === "unit" ||
      // "ounce" under a food already sold by the ounce is the same option twice.
      (b.short !== unitLabel(food.unit) && b.per(food.unit, grams) != null),
  );
  const buy = usable.find((b) => b.key === food.buyUnit) ?? usable[0];
  const per = (p: number | null | undefined) =>
    p == null ? null : buy.key === "unit" ? p : (priceInBuyUnit(p, buy.key, food.unit, grams) ?? p);

  /**
   * What is in each box while it is being typed in.
   *
   * The stored price is per the food's own unit, so a controlled field would
   * have to convert every keystroke back and forth — and "7." has no number to
   * convert, so the decimal point would disappear as you typed it. The text
   * stays exactly as typed, and the number behind it is committed on the way
   * past.
   */
  /**
   * Is this something a price could still turn into as it's typed?
   *
   * The box is plain text rather than a number input, because a number input
   * hands back "" the moment the text isn't a finished number — so the decimal
   * point in "7." vanishes under the cursor as you type $7.99. Text keeps what
   * was typed; this keeps out what isn't a price.
   */
  const priceish = (t: string) => /^\d*\.?\d*$/.test(t.trim());

  // Drafts are tagged with what they were typed against: a different food, or
  // a different unit to read it in, and they describe a number nobody is
  // typing any more, so they are simply not this render's drafts.
  const tag = `${food.id}|${buy.key}`;
  const [draft, setDraft] = useState<{ tag: string; text: Record<string, string> }>({ tag, text: {} });
  const drafts = draft.tag === tag ? draft.text : {};
  const setDraftFor = (storeId: string, text: string | null) =>
    setDraft(() => {
      const next = { ...drafts };
      if (text == null) delete next[storeId];
      else next[storeId] = text;
      return { tag, text: next };
    });

  const shown = (storeId: string, stored: number | null | undefined) => {
    const d = drafts[storeId];
    if (d != null) return d;
    const v = per(stored);
    if (v == null) return "";
    // Money reads with two decimals — but only where that is the same number.
    // A price converted out of another unit can carry more than a cent of
    // precision, and rounding it in an editable box would save the rounding.
    const money = v.toFixed(2);
    return Number(money) === v ? money : String(v);
  };

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Price per
          <select
            value={buy.key}
            onChange={(e) => updateFood(food.id, { buyUnit: e.target.value })}
            aria-label="Enter prices per"
            className="field rounded-lg px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          >
            {usable.map((b) => (
              <option key={b.key} value={b.key}>
                {b.key === "unit" ? unitLabel(food.unit) : b.label}
              </option>
            ))}
          </select>
        </label>
        {cheapest && (
          <p className="text-[11px] text-accent-soft">
            cheapest {fmtMoney(pricePerBuyUnit(cheapest.pricePerUnit, food, grams).amount)} /{" "}
            {pricePerBuyUnit(cheapest.pricePerUnit, food, grams).label}
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
                type="text" inputMode="decimal"
                value={shown(row.id, row.price?.pricePerUnit)}
                placeholder="0.00"
                onChange={(e) => {
                  const text = e.target.value;
                  if (!priceish(text)) return;
                  setDraftFor(row.id, text);
                  const v = text.trim();
                  if (v === "" || v === ".") {
                    setPrice(row.id, food.id, null);
                    return;
                  }
                  const typed = Math.max(0, Number(v) || 0);
                  const own =
                    buy.key === "unit"
                      ? typed
                      : pricePerOwnUnit(typed, buy.key, food.unit, grams);
                  if (own != null) setPrice(row.id, food.id, own);
                }}
                onBlur={() => setDraftFor(row.id, null)}
                aria-label={`Price of ${food.name} at ${row.name}`}
                className={`field w-20 rounded-lg px-2 py-1 text-right text-sm tabular-nums ${
                  isCheapest ? "ring-1 ring-accent" : ""
                }`}
              />
              <button
                onClick={() => {
                  setPrice(row.id, food.id, null);
                  setDraftFor(row.id, null);
                }}
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

      {buy.key !== "unit" && (
        <p className="mt-2 text-[11px] leading-4 text-muted">
          Prices for {food.name.toLowerCase()} are entered per {buy.label} from now on.
          Every $1 of that is {fmtMoney(pricePerOwnUnit(1, buy.key, food.unit, grams) ?? 0)}{" "}
          per {unitLabel(food.unit)}, the unit everything else costs in.
        </p>
      )}

      {stores.length === 0 && (
        <p className="mt-2 text-[11px] leading-4 text-muted">
          Add a store on the Stores tab and its own price for this food appears here,
          alongside the base one.
        </p>
      )}
    </div>
  );
}
