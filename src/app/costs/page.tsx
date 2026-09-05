"use client";

import { useMemo, useState } from "react";
import { addWeeks } from "date-fns";
import { DollarSign, Search, Store as StoreIcon, Copy, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useApp, neededQuantities } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { unitLabel } from "@/lib/units";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABEL } from "@/lib/foodcat";
import {
  BASE_STORE_ID,
  priceFor,
  fmtMoney,
  recipeTotalCost,
  recipeCostPerServing,
  plannedCost,
  quantitiesCost,
  inventoryValue,
  isComplete,
  type CostTotals,
} from "@/lib/cost";
import type { FoodCategory } from "@/lib/types";
import { SettingsButton } from "@/components/SettingsButton";

/** A money figure that says out loud when it is missing prices. */
function Money({ t, className = "" }: { t: CostTotals; className?: string }) {
  const short = t.lines - t.priced;
  return (
    <span className={className}>
      {fmtMoney(t.cost)}
      {short > 0 && (
        <span
          className="ml-1 text-[11px] font-normal text-warn-soft"
          title={`${short} of ${t.lines} ingredient lines have no price yet, so this total is low.`}
        >
          +{short} unpriced
        </span>
      )}
    </span>
  );
}

export default function Costs() {
  const {
    foods, recipes, plan, inventory, prices, stores, selectedStoreId,
    selectStore, setPrice, seedStorePricesFromBase,
  } = useApp();

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<FoodCategory | "all">("all");
  const [copied, setCopied] = useState<number | null>(null);

  const storeName =
    selectedStoreId === BASE_STORE_ID
      ? "Base prices"
      : (stores.find((s) => s.id === selectedStoreId)?.name ?? "Base prices");

  const week = weekDays(addWeeks(new Date(), 0)).map(isoOf);
  const weekMeals = plan.filter((m) => week.includes(m.date));

  const weekSpend = plannedCost(weekMeals, recipes, prices, selectedStoreId);
  const shopSpend = quantitiesCost(
    // Only what you actually still need to buy this week.
    Object.fromEntries(
      Object.entries(neededQuantities(weekMeals, recipes)).map(([id, qty]) => {
        const have = inventory.find((i) => i.foodId === id)?.quantity ?? 0;
        return [id, Math.max(0, qty - have)];
      }).filter(([, qty]) => (qty as number) > 0.001),
    ),
    prices,
    selectedStoreId,
  );
  const kitchenValue = inventoryValue(inventory, prices, selectedStoreId);

  const coverage = useMemo(() => {
    const priced = foods.filter((f) => priceFor(prices, selectedStoreId, f.id) !== null).length;
    return { priced, total: foods.length };
  }, [foods, prices, selectedStoreId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => (cat === "all" ? true : f.category === cat))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, query, cat]);

  const byCategory = useMemo(() => {
    const map = new Map<FoodCategory, typeof visible>();
    for (const f of visible) {
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return map;
  }, [visible]);

  const recipeRows = useMemo(
    () =>
      recipes
        .map((r) => ({
          recipe: r,
          total: recipeTotalCost(r, recipes, prices, selectedStoreId),
          per: recipeCostPerServing(r, recipes, prices, selectedStoreId),
        }))
        .sort((a, b) => b.per.cost - a.per.cost),
    [recipes, prices, selectedStoreId],
  );

  const onCopyBase = () => {
    const n = seedStorePricesFromBase(selectedStoreId);
    setCopied(n);
    setTimeout(() => setCopied(null), 4000);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cost repository</h1>
          <p className="mt-1 text-sm text-muted">
            Every ingredient priced per its own unit — recipes, the plan and your grocery list cost themselves from here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StoreIcon size={16} className="text-muted" />
          <select
            value={selectedStoreId}
            onChange={(e) => selectStore(e.target.value)}
            className="field rounded-xl px-3 py-2 text-sm"
          >
            <option value={BASE_STORE_ID}>Base prices (any store)</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` — ${s.city}` : ""}
              </option>
            ))}
          </select>
          <SettingsButton className="hidden md:flex" />
        </div>
      </header>

      {/* Roll-ups: the same numbers the other tabs will show. */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="This week's meals" value={<Money t={weekSpend} />} hint="Cost of everything planned" />
        <Stat label="Still to buy" value={<Money t={shopSpend} />} hint="Plan minus what's in the kitchen" />
        <Stat label="Kitchen on hand" value={<Money t={kitchenValue} />} hint="Value of current stock" />
        <Stat
          label="Priced foods"
          value={
            <span className={coverage.priced === coverage.total ? "text-accent-soft" : ""}>
              {coverage.priced}
              <span className="text-muted">/{coverage.total}</span>
            </span>
          }
          hint={`At ${storeName}`}
        />
      </div>

      {selectedStoreId !== BASE_STORE_ID && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl card px-4 py-3 text-sm">
          <p className="text-muted">
            Blank prices at <span className="text-ink">{storeName}</span> fall back to your base
            price. Fill one in to override it for this store only.
          </p>
          <button
            onClick={onCopyBase}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium field hover:brightness-125"
          >
            <Copy size={14} />
            {copied == null ? "Copy base prices here" : copied === 0 ? "Nothing to copy" : `Copied ${copied}`}
          </button>
        </div>
      )}

      {/* --- The repository itself --- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredients…"
            className="field w-full rounded-xl py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as FoodCategory | "all")}
          className="field rounded-xl px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {FOOD_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 py-16 text-center text-sm text-muted">
          No ingredients match that search.
        </div>
      ) : (
        <div className="space-y-5">
          {FOOD_CATEGORIES.filter((c) => byCategory.has(c.key)).map((c) => (
            <section key={c.key}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {c.emoji} {FOOD_CATEGORY_LABEL[c.key]}
              </h2>
              <div className="overflow-hidden rounded-2xl card">
                {byCategory.get(c.key)!.map((f) => {
                  const own = prices.find(
                    (p) => p.storeId === selectedStoreId && p.foodId === f.id,
                  );
                  const effective = priceFor(prices, selectedStoreId, f.id);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
                    >
                      <span className="w-6 shrink-0 text-center">{f.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm leading-tight">{f.name}</div>
                        <div className="text-[11px] text-muted">
                          {f.caloriesPerUnit} cal / {unitLabel(f.unit)}
                          {effective && effective.source === "base" && selectedStoreId !== BASE_STORE_ID && (
                            <span className="ml-2 text-sea-soft">using base price</span>
                          )}
                          {!effective && (
                            <span className="ml-2 text-warn-soft">no price yet</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-muted">$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          inputMode="decimal"
                          value={own ? own.pricePerUnit : ""}
                          placeholder={
                            effective && effective.source === "base"
                              ? effective.pricePerUnit.toFixed(2)
                              : "0.00"
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setPrice(selectedStoreId, f.id, v === "" ? null : Number(v));
                          }}
                          className="field w-20 rounded-lg px-2 py-1.5 text-right text-sm tabular-nums sm:w-24"
                          aria-label={`Price per ${unitLabel(f.unit)} of ${f.name}`}
                        />
                        <span className="w-9 text-left text-[11px] text-muted sm:w-12 sm:text-xs">
                          /{unitLabel(f.unit)}
                        </span>
                        <button
                          onClick={() => setPrice(selectedStoreId, f.id, null)}
                          disabled={!own}
                          title={own ? "Clear this price" : "No price set here"}
                          className="hidden rounded-lg p-1.5 text-faint enabled:hover:bg-surface-3 enabled:hover:text-ink-2 disabled:opacity-30 sm:block"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* --- What that costs, per recipe --- */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Recipe cost
          </h2>
          <span className="text-[11px] text-muted">at {storeName}</span>
        </div>
        <div className="overflow-hidden rounded-2xl card">
          <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            <span className="flex-1">Recipe</span>
            <span className="w-28 text-right">Per serving</span>
            <span className="w-32 text-right">Whole recipe</span>
          </div>
          {recipeRows.map(({ recipe, total, per }) => (
            <div key={recipe.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate">
                {recipe.emoji} {recipe.name}
                <span className="ml-2 text-[11px] text-muted">{recipe.servings} servings</span>
              </span>
              <span className="w-28 text-right tabular-nums">
                {isComplete(per) || per.priced > 0 ? fmtMoney(per.cost) : <span className="text-faint">—</span>}
              </span>
              <span className="w-32 text-right tabular-nums">
                <Money t={total} />
              </span>
            </div>
          ))}
        </div>
        {recipeRows.some((r) => !isComplete(r.total)) && (
          <p className="mt-2 flex items-start gap-2 text-[11px] text-warn-soft">
            <TriangleAlert size={13} className="mt-px shrink-0" />
            Recipes marked &ldquo;unpriced&rdquo; are missing a price on at least one ingredient, so
            their totals are lower than the real cost. Fill those in above.
          </p>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-muted">
        Shopping somewhere else?{" "}
        <Link href="/stores" className="text-accent-soft hover:underline">
          Pick a store
        </Link>{" "}
        and every figure here re-costs against it.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-2xl card px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <DollarSign size={12} /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
    </div>
  );
}
