"use client";

import { useMemo, useState } from "react";
import { DollarSign, Store as StoreIcon, Copy, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import {
  BASE_STORE_ID,
  BEST_STORE_ID,
  bestPriceFor,
  priceFor,
  fmtMoney,
  recipeTotalCost,
  recipeCostPerServing,
  inventoryValue,
  isComplete,
  type CostTotals
} from "@/lib/cost";
import { SettingsButton } from "@/components/SettingsButton";
import { FoodShelves } from "@/components/FoodShelves";
import { unitLabel } from "@/lib/units";

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
    foods, recipes, inventory, prices, stores, selectedStoreId,
    selectStore, seedStorePricesFromBase
  } = useApp();

  const [copied, setCopied] = useState<number | null>(null);

  const storeName =
    selectedStoreId === BEST_STORE_ID
      ? "Best price"
      : selectedStoreId === BASE_STORE_ID
        ? "Base prices"
        : (stores.find((s) => s.id === selectedStoreId)?.name ?? "Base prices");

  const kitchenValue = inventoryValue(inventory, prices, selectedStoreId);

  const coverage = useMemo(() => {
    const priced = foods.filter((f) => priceFor(prices, selectedStoreId, f.id) !== null).length;
    return { priced, total: foods.length };
  }, [foods, prices, selectedStoreId]);

  /**
   * Every ingredient priced somewhere real, across every shop. Foods only the
   * base row knows about are left out: a single column of typical figures is
   * not a comparison, and it would bury the rows that are.
   */
  const comparison = useMemo(() => {
    const columns = [BASE_STORE_ID, ...stores.map((s) => s.id)];
    return foods
      .map((food) => {
        const cells = columns.map((storeId) => ({
          storeId,
          price: prices.find((p) => p.storeId === storeId && p.foodId === food.id)?.pricePerUnit ?? null,
        }));
        return { food, cells, best: bestPriceFor(prices, food.id)?.storeId };
      })
      .filter((r) => r.cells.some((c) => c.storeId !== BASE_STORE_ID && c.price != null))
      .sort((a, b) => a.food.name.localeCompare(b.food.name));
  }, [foods, prices, stores]);

  const recipeRows = useMemo(
    () =>
      recipes
        .map((r) => ({
          recipe: r,
          total: recipeTotalCost(r, recipes, prices, selectedStoreId),
          per: recipeCostPerServing(r, recipes, prices, selectedStoreId)
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
            <option value={BEST_STORE_ID}>Best price — cheapest of your stores</option>
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

      {/* --- The repository itself: the same shelves the other two tabs use --- */}
      <FoodShelves mode="price" foods={foods} />

      {/* --- Every ingredient, at every shop --- */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Price by store
          </h2>
          <span className="text-[11px] text-muted">
            cheapest is what &ldquo;Best price&rdquo; costs against
          </span>
        </div>
        <div className="overflow-x-auto rounded-2xl card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[11px] font-medium uppercase tracking-wide text-muted">
                <th className="px-4 py-2 text-left font-medium">Ingredient</th>
                <th className="px-3 py-2 text-right font-medium">Base</th>
                {stores.map((st) => (
                  <th key={st.id} className="px-3 py-2 text-right font-medium">
                    <span className="block max-w-24 truncate">{st.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map(({ food, cells, best }) => (
                <tr key={food.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <span className="block truncate">{food.name}</span>
                    <span className="text-[10px] text-muted">per {unitLabel(food.unit)}</span>
                  </td>
                  {cells.map((c) => (
                    <td
                      key={c.storeId}
                      className={`px-3 py-2 text-right tabular-nums ${
                        c.price == null
                          ? "text-faint"
                          : c.storeId === best
                            ? "font-semibold text-accent-soft"
                            : "text-ink-2"
                      }`}
                    >
                      {c.price == null ? "—" : fmtMoney(c.price)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {comparison.length === 0 && (
          <p className="mt-2 text-[11px] text-muted">
            No ingredient is priced at more than one place yet — import a receipt at a
            second store and the comparison fills in.
          </p>
        )}
        {stores.length === 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Only base prices so far. Add a store on the Stores tab, or file a receipt
            against one, and its column appears here.
          </p>
        )}
      </section>

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
                {recipe.name}
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
