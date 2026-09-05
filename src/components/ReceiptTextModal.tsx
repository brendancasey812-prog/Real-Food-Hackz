"use client";

import { useMemo, useState } from "react";
import { X, ClipboardList, Check, ArrowLeft, TriangleAlert } from "lucide-react";
import { useApp, newId, foodById } from "@/lib/store";
import { normalizeName } from "@/lib/receipt";
import { parseReceiptText, amountInUnit, unitPrice, type ReceiptTextLine } from "@/lib/receipttext";
import { usdaFor, gramsPerUnit } from "@/lib/usda";
import { UNITS, unitLabel, pluralUnit } from "@/lib/units";
import { fmtMoney, BASE_STORE_ID } from "@/lib/cost";
import type { Food, Unit } from "@/lib/types";

const NEW = "__new__";

/** One receipt line, resolved against the catalogue and ready to commit. */
interface Row {
  line: ReceiptTextLine;
  /** The food it goes to, or NEW to create one. */
  foodId: string;
  /** How much of it, in the food's unit. */
  amount: number;
  /** What one unit worked out at, in dollars. */
  price: number | null;
  /** True when the weight couldn't be turned into the food's unit. */
  needsAmount: boolean;
  /** For a brand-new food. */
  newUnit: Unit;
}

/**
 * Paste a receipt, get a stocked kitchen and a priced store.
 *
 * A photographed receipt tells us what you bought; a pasted one also tells us
 * what it weighed and what it cost, which is enough to work out what a unit
 * actually costs at that store. Everything is shown before it lands, because a
 * receipt names products and the kitchen holds foods — "Dannon Oikos Triple
 * Zero" is your Greek yogurt, and only you can say so.
 */
export function ReceiptTextModal({ onClose }: { onClose: () => void }) {
  const { foods, stores, selectedStoreId, setInventory, inventory, addFood, setPrice } = useApp();
  const [step, setStep] = useState<"paste" | "review" | "done">("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [storeId, setStoreId] = useState(selectedStoreId);
  const [summary, setSummary] = useState({ stocked: 0, priced: 0, created: 0 });

  const storeName =
    storeId === BASE_STORE_ID
      ? "Base prices"
      : (stores.find((s) => s.id === storeId)?.name ?? "Base prices");

  /** Best guess at which food a receipt line is, by name. */
  const matchFood = (line: ReceiptTextLine): Food | undefined => {
    const target = normalizeName(line.food);
    const words = target.split(" ").filter((w) => w.length > 2);
    let best: { food: Food; score: number } | undefined;
    for (const f of foods) {
      const name = normalizeName(f.name);
      let score = 0;
      if (name === target) score = 100;
      else if (name.includes(target) || target.includes(name)) score = 60;
      else score = words.filter((w) => name.includes(w)).length * 20;
      // A food already in the right group is likelier to be the right one.
      if (score > 0 && f.category === line.category) score += 10;
      if (score > 0 && (!best || score > best.score)) best = { food: f, score };
    }
    return best && best.score >= 20 ? best.food : undefined;
  };

  const buildRow = (line: ReceiptTextLine, food: Food | undefined): Row => {
    const unit: Unit = food?.unit ?? (line.grams != null ? "oz" : "each");
    const grams = food ? gramsFor(food, unit) : (unit === "oz" ? 28.35 : null);
    const amount = amountInUnit(line, unit, grams);
    return {
      line,
      foodId: food?.id ?? NEW,
      amount: amount ?? 1,
      price: unitPrice(line.total, amount ?? 1),
      needsAmount: amount == null,
      newUnit: unit,
    };
  };

  const gramsFor = (food: Food, unit: Unit): number | null => {
    const ref = usdaFor(food);
    return ref ? gramsPerUnit(ref.match.entry, unit) : (unit === "oz" ? 28.35 : null);
  };

  const parse = () => {
    const lines = parseReceiptText(text);
    setRows(lines.map((l) => buildRow(l, matchFood(l))));
    setStep("review");
  };

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  /** Re-derive the amount when the row is pointed at a different food. */
  const retarget = (i: number, foodId: string) => {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const food = foodId === NEW ? undefined : foodById(foods, foodId);
        const next = buildRow(r.line, food);
        return { ...next, foodId };
      }),
    );
  };

  const setAmount = (i: number, amount: number) =>
    setRows((rs) =>
      rs.map((r, idx) =>
        idx === i
          ? { ...r, amount, price: unitPrice(r.line.total, amount), needsAmount: false }
          : r,
      ),
    );

  const totals = useMemo(
    () => ({
      spend: rows.reduce((s, r) => s + r.line.total, 0),
      unresolved: rows.filter((r) => r.needsAmount).length,
    }),
    [rows],
  );

  const commit = () => {
    let stocked = 0;
    let priced = 0;
    let created = 0;

    for (const r of rows) {
      if (r.amount <= 0) continue;
      let id = r.foodId;

      if (id === NEW) {
        id = newId();
        addFood(
          {
            id,
            name: titleCase(r.line.food),
            unit: r.newUnit,
            caloriesPerUnit: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            location: r.line.location,
            category: r.line.category,
            source: "receipt_scan",
          },
          0,
        );
        created++;
      }

      const have = inventory.find((i) => i.foodId === id)?.quantity ?? 0;
      setInventory(id, have + r.amount);
      stocked++;

      if (r.price != null && r.price > 0) {
        setPrice(storeId, id, r.price);
        priced++;
      }
    }

    setSummary({ stocked, priced, created });
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-3xl border border-line bg-page md:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {step === "review" ? (
            <button onClick={() => setStep("paste")} className="flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ClipboardList size={16} className="text-accent-soft" /> Paste a receipt
            </span>
          )}
          {step === "review" && <span className="text-sm font-semibold text-ink">Check {rows.length} items</span>}
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "paste" && (
            <>
              <p className="mb-3 text-sm text-muted">
                Paste the text of an order summary or emailed receipt. Weighed lines
                (&ldquo;1.05lb @6.99/lb&rdquo;) let the app work out what a unit costs, so
                your prices update at the same time as your kitchen.
              </p>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder={"PRODUCE\nBananas - 2.63lb @0.99/lb\t$2.60\nQuantity: 1"}
                className="field w-full rounded-xl p-3 font-mono text-xs leading-5"
              />
            </>
          )}

          {step === "review" && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Prices go to</span>
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="field rounded-xl px-3 py-2 text-sm"
                  >
                    <option value={BASE_STORE_ID}>Base prices (any store)</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ""}</option>
                    ))}
                  </select>
                </label>
                <span className="text-sm text-muted">
                  {rows.length} items · <span className="font-medium text-ink">{fmtMoney(totals.spend)}</span>
                </span>
              </div>

              {totals.unresolved > 0 && (
                <p className="mb-3 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] leading-4 text-warn-soft">
                  <TriangleAlert size={13} className="mt-px shrink-0" />
                  {totals.unresolved} {totals.unresolved === 1 ? "line was" : "lines were"} sold by weight
                  into a food measured by volume, and nothing here says how much a cup of it
                  weighs. Set the amount yourself and the price follows.
                </p>
              )}

              <div className="space-y-2">
                {rows.map((r, i) => {
                  const food = r.foodId === NEW ? undefined : foodById(foods, r.foodId);
                  const unit = food?.unit ?? r.newUnit;
                  return (
                    <div key={i} className={`rounded-xl border p-2.5 ${r.needsAmount ? "border-warn/50" : "border-line"}`}>
                      <div className="mb-1.5 truncate text-[11px] text-muted" title={r.line.raw}>
                        {r.line.label} · {fmtMoney(r.line.total)}
                        {r.line.grams != null && ` · ${(r.line.grams / 453.6).toFixed(2)} lb`}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={r.foodId}
                          onChange={(e) => retarget(i, e.target.value)}
                          className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <option value={NEW}>New food — &ldquo;{titleCase(r.line.food)}&rdquo;</option>
                          {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>

                        {r.foodId === NEW && (
                          <select
                            value={r.newUnit}
                            onChange={(e) => patch(i, { newUnit: e.target.value as Unit })}
                            className="field rounded-lg px-2 py-1.5 text-sm"
                          >
                            {UNITS.map((u) => <option key={u.value} value={u.value}>per {u.label}</option>)}
                          </select>
                        )}

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={0} step={0.25} value={r.amount}
                            onChange={(e) => setAmount(i, Math.max(0, Number(e.target.value) || 0))}
                            aria-label={`Amount of ${r.line.label}`}
                            className="field w-20 rounded-lg px-2 py-1.5 text-right text-sm"
                          />
                          <span className="w-10 shrink-0 text-xs text-muted">{pluralUnit(r.amount, unit)}</span>
                        </div>

                        <span className={`shrink-0 text-xs tabular-nums ${r.price ? "text-accent-soft" : "text-warn-soft"}`}>
                          {r.price ? `${fmtMoney(r.price)} / ${unitLabel(unit)}` : "no price"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft">
                <Check size={28} />
              </span>
              <p className="font-semibold text-ink">Receipt added</p>
              <p className="max-w-sm text-sm text-muted">
                {summary.stocked} {summary.stocked === 1 ? "food" : "foods"} stocked
                {summary.created > 0 && `, ${summary.created} newly created`} · {summary.priced} priced
                at <span className="text-ink-2">{storeName}</span>.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-line px-5 py-4">
          {step === "paste" && (
            <button
              onClick={parse}
              disabled={!text.trim()}
              className="btn-accent w-full rounded-xl py-3 text-sm disabled:opacity-40"
            >
              Read {text.trim() ? "receipt" : "…"}
            </button>
          )}
          {step === "review" && (
            <button onClick={commit} className="btn-accent w-full rounded-xl py-3 text-sm">
              Stock {rows.length} items and price them at {storeName}
            </button>
          )}
          {step === "done" && (
            <button onClick={onClose} className="btn-accent w-full rounded-xl py-3 text-sm">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

const titleCase = (s: string) =>
  s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
