"use client";

import { useMemo, useState } from "react";
import { X, ClipboardList, Check, ArrowLeft, TriangleAlert, Store as StoreIcon } from "lucide-react";
import { useApp, newId, foodById } from "@/lib/store";
import {
  parseReceiptText, amountInUnit, unitPrice, rankFoods,
  type ReceiptTextLine, type FoodSuggestion,
} from "@/lib/receipttext";
import { gramsForFood, searchUsda, unitNutrition } from "@/lib/usda";
import { UNITS, unitLabel, pluralUnit } from "@/lib/units";
import { fmtMoney, BASE_STORE_ID } from "@/lib/cost";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import type { FoodCategory, Unit } from "@/lib/types";

const NEW = "__new__";

/** Below this the match is a guess and the row says so. */
const SURE = 0.55;

interface Nutrition {
  caloriesPerUnit: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** One receipt line, resolved against the catalogue and ready to commit. */
interface Row {
  line: ReceiptTextLine;
  /** The food it goes to, or NEW to create one. */
  foodId: string;
  /** How much of it, in the food's unit. Never left at zero on commit. */
  amount: number;
  /** True when the amount is the app's guess rather than something it knew. */
  guessedAmount: boolean;
  /** True when the amount came from a typical weight rather than a published one. */
  estimated: boolean;
  /** How sure the food match is, 0-1. */
  confidence: number;
  /** Other foods this line could be, best first. */
  similar: FoodSuggestion[];
  /** Per-unit nutrition — the matched food's, or looked up for a new one. */
  nutrition: Nutrition;
  /** Left out of the import — a receipt has more on it than groceries. */
  skip: boolean;
  /** For a brand-new food. */
  newName: string;
  newUnit: Unit;
  newCategory: FoodCategory;
}

/**
 * Paste a receipt, get a stocked kitchen and a priced store.
 *
 * A photographed receipt says what you bought; a pasted one also says what it
 * weighed and what it cost, which is enough to work out what a unit actually
 * costs at that store. Three rules shape this screen:
 *
 *  - Every line lands with a quantity and a price. A row the app can't work
 *    out is not skipped and not silently defaulted — it is marked and blocks
 *    the button until you settle it.
 *  - When the match is a guess, it says so and puts the alternatives in front
 *    of you rather than hiding them in a dropdown.
 *  - Calories are editable here, because a food created from a receipt would
 *    otherwise enter the app worth nothing in a calorie planner.
 */
export function ReceiptTextModal({ onClose }: { onClose: () => void }) {
  const { foods, stores, selectedStoreId, setInventory, inventory, addFood, updateFood, setPrice } = useApp();
  const [step, setStep] = useState<"paste" | "review" | "done">("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [storeId, setStoreId] = useState(selectedStoreId);
  const [summary, setSummary] = useState({ stocked: 0, priced: 0, created: 0 });

  const storeName =
    storeId === BASE_STORE_ID
      ? "Base prices"
      : (stores.find((s) => s.id === storeId)?.name ?? "Base prices");

  /** What the bundled reference says a food of this name and unit is worth. */
  const referenceNutrition = (name: string, unit: Unit, category: FoodCategory): Nutrition => {
    const hit = searchUsda(name, 1)[0];
    const per = hit ? unitNutrition(hit.entry, unit, { category }) : null;
    return per?.nutrition ?? { caloriesPerUnit: 0, protein: 0, carbs: 0, fat: 0 };
  };

  const buildRow = (line: ReceiptTextLine, pick: FoodSuggestion | undefined): Row => {
    const similar = rankFoods(foods, line.food, 4, line.category);
    const food = pick?.food;
    const unit: Unit = food?.unit ?? (line.grams != null ? "oz" : "each");
    const weight = food
      ? gramsForFood(food)
      : unit === "oz"
        ? { grams: 28.349523, estimated: false }
        : null;
    const amount = amountInUnit(line, unit, weight?.grams ?? null);

    return {
      line,
      foodId: food?.id ?? NEW,
      // A row always carries a number; when it is ours rather than the
      // receipt's, it is flagged and has to be confirmed.
      amount: amount ?? line.quantity,
      guessedAmount: amount == null,
      estimated: amount != null && Boolean(weight?.estimated),
      confidence: pick?.score ?? 0,
      similar,
      nutrition: food
        ? { caloriesPerUnit: food.caloriesPerUnit, protein: food.protein, carbs: food.carbs, fat: food.fat }
        : referenceNutrition(line.food, unit, line.category),
      // Most states don't tax food, so a taxed line is usually the shampoo.
      // Defaulted out rather than dropped, because the till isn't always right.
      skip: line.taxable === true,
      newName: titleCase(line.food),
      newUnit: unit,
      newCategory: line.category,
    };
  };

  const parse = () => {
    setRows(
      parseReceiptText(text).map((l) => {
        const best = rankFoods(foods, l.food, 1, l.category)[0];
        return buildRow(l, best && best.score >= 0.3 ? best : undefined);
      }),
    );
    setStep("review");
  };

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  /**
   * Changing a new food's unit or type changes what the reference says it is
   * worth — a cup of romaine and one romaine are different numbers — so the
   * calories are looked up again rather than left stale. An amount already
   * typed by hand is left alone; one the app derived is re-derived.
   */
  const rebase = (i: number, p: { newUnit?: Unit; newCategory?: FoodCategory }) =>
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const unit = p.newUnit ?? r.newUnit;
        const category = p.newCategory ?? r.newCategory;
        const weight = gramsForFood({ name: r.newName, unit, category });
        const derived = amountInUnit(r.line, unit, weight?.grams ?? null);
        return {
          ...r,
          ...p,
          nutrition: referenceNutrition(r.line.food, unit, category),
          amount: r.guessedAmount ? (derived ?? r.amount) : r.amount,
          guessedAmount: r.guessedAmount && derived == null,
          estimated: derived != null && Boolean(weight?.estimated),
        };
      }),
    );

  /** Point a row at a different food, and re-derive everything that follows. */
  const retarget = (i: number, foodId: string) =>
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const food = foodId === NEW ? undefined : foodById(foods, foodId);
        const next = buildRow(r.line, food ? { food, score: 1, matched: [] } : undefined);
        // A choice made by hand is certain by definition.
        return { ...next, foodId, confidence: 1, newName: r.newName, newCategory: r.newCategory };
      }),
    );

  const unitOf = (r: Row) =>
    r.foodId === NEW ? r.newUnit : foodById(foods, r.foodId)?.unit ?? r.newUnit;

  /** Price per unit, derived — never typed, never missing while there's an amount. */
  const priceOf = (r: Row) => unitPrice(r.line.total, r.amount);

  /** Rows that still need a person: no amount, or a match we aren't sure of. */
  const kept = rows.filter((r) => !r.skip);
  const unsettled = useMemo(
    () => rows.filter((r) => !r.skip && (r.amount <= 0 || r.guessedAmount || r.confidence < SURE)),
    [rows],
  );
  const blocked = kept.filter((r) => r.amount <= 0);

  const commit = () => {
    let stocked = 0, priced = 0, created = 0;

    for (const r of rows) {
      if (r.skip || r.amount <= 0) continue;
      let id = r.foodId;

      if (id === NEW) {
        id = newId();
        addFood(
          {
            id,
            name: r.newName.trim() || titleCase(r.line.food),
            unit: r.newUnit,
            caloriesPerUnit: Math.max(0, r.nutrition.caloriesPerUnit),
            protein: Math.max(0, r.nutrition.protein),
            carbs: Math.max(0, r.nutrition.carbs),
            fat: Math.max(0, r.nutrition.fat),
            location: r.line.location,
            category: r.newCategory,
            source: "receipt_scan",
            nutritionSource: r.nutrition.caloriesPerUnit > 0 ? "usda" : undefined,
          },
          0,
        );
        created++;
      } else {
        // Calories edited here belong to the food, not just this receipt.
        const existing = foodById(foods, id);
        if (existing && existing.caloriesPerUnit !== r.nutrition.caloriesPerUnit) {
          updateFood(id, { ...r.nutrition, nutritionSource: "manual" });
        }
      }

      const have = inventory.find((i) => i.foodId === id)?.quantity ?? 0;
      setInventory(id, have + r.amount);
      stocked++;

      const p = priceOf(r);
      if (p != null && p > 0) {
        setPrice(storeId, id, p);
        priced++;
      }
    }

    setSummary({ stocked, priced, created });
    setStep("done");
  };

  const spend = kept.reduce((s, r) => s + r.line.total, 0);

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
          {step === "review" && (
            <span className="text-sm font-semibold text-ink">
              {kept.length} items · {fmtMoney(spend)}
            </span>
          )}
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "paste" && (
            <>
              <p className="mb-3 text-sm text-muted">
                Paste the text of an order summary or emailed receipt. Weighed lines
                (&ldquo;1.05lb @6.99/lb&rdquo;) and printed pack sizes (&ldquo;32oz&rdquo;) let the app work
                out what a unit costs, so your prices update with your kitchen.
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
              {/* Which store these prices belong to */}
              <label className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
                <StoreIcon size={15} className="shrink-0 text-muted" />
                <span className="text-sm text-ink-2">Shopped at</span>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value={BASE_STORE_ID}>Base prices (any store)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ""}</option>
                  ))}
                </select>
                <span className="w-full text-[11px] leading-4 text-muted">
                  Every price below is recorded against {storeName}, and the foods go to
                  your fridge, freezer or pantry as filed.
                </span>
              </label>

              {unsettled.length > 0 && (
                <p className="mb-3 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] leading-4 text-warn-soft">
                  <TriangleAlert size={13} className="mt-px shrink-0" />
                  {unsettled.length} {unsettled.length === 1 ? "line is" : "lines are"} highlighted
                  below — either the food is a guess or the amount is. Check those and
                  the rest will follow.
                </p>
              )}

              <div className="space-y-2">
                {rows.map((r, i) => {
                  const unit = unitOf(r);
                  const price = priceOf(r);
                  const unsure = r.confidence < SURE || r.guessedAmount;
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-2.5 ${
                        r.skip
                          ? "border-line opacity-50"
                          : r.amount <= 0
                            ? "border-danger/60 bg-danger/5"
                            : unsure
                              ? "border-warn/50 bg-warn/5"
                              : "border-line"
                      }`}
                    >
                      {/* The receipt line, verbatim */}
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px] text-muted" title={r.line.raw}>
                          {r.line.label}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-ink-2">
                          {fmtMoney(r.line.total)}
                          {r.line.grams != null && (
                            <span className="font-normal text-muted">
                              · {(r.line.grams / 453.6).toFixed(2)} lb
                            </span>
                          )}
                          <button
                            onClick={() => patch(i, { skip: !r.skip })}
                            aria-pressed={r.skip}
                            title={r.skip ? "Include this line" : "Leave this line out"}
                            className={`rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              r.skip
                                ? "bg-accent text-on-accent"
                                : "border border-line text-muted hover:bg-surface-3"
                            }`}
                          >
                            {r.skip ? "Skipped" : "Skip"}
                          </button>
                        </span>
                      </div>

                      {r.skip ? (
                        <p className="text-[11px] text-muted">
                          Left out — the till taxed this line, so it probably isn&apos;t food.
                        </p>
                      ) : (
                      <>
                      {/* Which food — alternatives up front when we aren't sure */}
                      {(unsure || r.similar.length > 0) && (
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          {r.similar.map((sg) => (
                            <button
                              key={sg.food.id}
                              onClick={() => retarget(i, sg.food.id)}
                              aria-pressed={r.foodId === sg.food.id}
                              title={sg.matched.length ? `Matched on ${sg.matched.join(", ")}` : undefined}
                              className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                                r.foodId === sg.food.id
                                  ? "bg-accent text-on-accent"
                                  : "border border-line text-ink-2 hover:bg-surface-3"
                              }`}
                            >
                              {sg.food.name}
                            </button>
                          ))}
                          <button
                            onClick={() => retarget(i, NEW)}
                            aria-pressed={r.foodId === NEW}
                            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                              r.foodId === NEW
                                ? "bg-accent text-on-accent"
                                : "border border-dashed border-line text-muted hover:bg-surface-3"
                            }`}
                          >
                            New food
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {r.foodId === NEW ? (
                          <input
                            value={r.newName}
                            onChange={(e) => patch(i, { newName: e.target.value })}
                            aria-label={`Name for ${r.line.label}`}
                            className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
                          />
                        ) : (
                          <select
                            value={r.foodId}
                            onChange={(e) => retarget(i, e.target.value)}
                            className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
                          >
                            <option value={NEW}>New food…</option>
                            {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        )}

                        {r.foodId === NEW && (
                          <>
                            <select
                              value={r.newUnit}
                              onChange={(e) => rebase(i, { newUnit: e.target.value as Unit })}
                              className="field rounded-lg px-2 py-1.5 text-sm"
                              aria-label="Unit"
                            >
                              {UNITS.map((u) => <option key={u.value} value={u.value}>per {u.label}</option>)}
                            </select>
                            <select
                              value={r.newCategory}
                              onChange={(e) => rebase(i, { newCategory: e.target.value as FoodCategory })}
                              className="field rounded-lg px-2 py-1.5 text-sm"
                              aria-label="Food type"
                            >
                              {FOOD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                          </>
                        )}
                      </div>

                      {/* Quantity, the price it implies, and what it's worth */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <label className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-muted">Qty</span>
                          <input
                            type="number" min={0} step={0.25} value={r.amount}
                            onChange={(e) =>
                              patch(i, {
                                amount: Math.max(0, Number(e.target.value) || 0),
                                guessedAmount: false,
                              })
                            }
                            aria-label={`Amount of ${r.line.label}`}
                            className="field w-20 rounded-lg px-2 py-1 text-right text-sm"
                          />
                          <span className="w-10 text-xs text-muted">{pluralUnit(r.amount, unit)}</span>
                        </label>

                        <span className="text-xs tabular-nums">
                          {price != null && price > 0 ? (
                            <span className="text-accent-soft">
                              {fmtMoney(price)} / {unitLabel(unit)}
                            </span>
                          ) : (
                            <span className="text-danger-soft">set a quantity to price it</span>
                          )}
                          {r.estimated && (
                            <span className="ml-1 text-muted" title="Converted using a typical weight — adjust if you know better.">
                              est.
                            </span>
                          )}
                        </span>

                        <label className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-muted">Cal</span>
                          <input
                            type="number" min={0} value={r.nutrition.caloriesPerUnit}
                            onChange={(e) =>
                              patch(i, {
                                nutrition: {
                                  ...r.nutrition,
                                  caloriesPerUnit: Math.max(0, Number(e.target.value) || 0),
                                },
                              })
                            }
                            aria-label={`Calories per ${unitLabel(unit)} of ${r.line.label}`}
                            className="field w-16 rounded-lg px-2 py-1 text-right text-sm"
                          />
                          <span className="text-xs text-muted">/ {unitLabel(unit)}</span>
                        </label>

                        {r.nutrition.caloriesPerUnit === 0 && (
                          <span className="text-[10px] text-warn-soft">no calories yet</span>
                        )}
                      </div>
                      </>
                      )}
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

        <div className="shrink-0 border-t border-line px-5 py-4">
          {step === "paste" && (
            <button
              onClick={parse}
              disabled={!text.trim()}
              className="btn-accent w-full rounded-xl py-3 text-sm disabled:opacity-40"
            >
              Read receipt
            </button>
          )}
          {step === "review" && (
            <>
              <button
                onClick={commit}
                disabled={blocked.length > 0}
                className="btn-accent w-full rounded-xl py-3 text-sm disabled:opacity-40"
              >
                {blocked.length > 0
                  ? `${blocked.length} ${blocked.length === 1 ? "line needs" : "lines need"} a quantity`
                  : `Stock ${kept.length} items and price them at ${storeName}`}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted">
                {fmtMoney(spend)} · {kept.filter((r) => r.nutrition.caloriesPerUnit === 0).length} without
                calories{rows.length !== kept.length && ` · ${rows.length - kept.length} skipped`}
              </p>
            </>
          )}
          {step === "done" && (
            <button onClick={onClose} className="btn-accent w-full rounded-xl py-3 text-sm">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
