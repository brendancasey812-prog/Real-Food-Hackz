"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw, Loader2, TriangleAlert, Search, ChevronDown, Download,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { krogerSource } from "@/lib/kroger";
import { normalizeIngredient, daysSince, type PriceSource } from "@/lib/pricesource";
import { usdaFor, gramsPerUnit } from "@/lib/usda";
import { unitLabel } from "@/lib/units";
import { priceFor } from "@/lib/cost";
import { FOOD_CATEGORY_LABEL } from "@/lib/foodcat";
import { download, exportName } from "@/lib/exportfile";
import type { Food, Store } from "@/lib/types";

/** How stale a cached quote may be before the panel offers to refresh it. */
const MAX_AGE_DAYS = 1;

/**
 * Mapping ingredients to what they cost at a specific store.
 *
 * Two things are deliberately separate here. Looking a price up caches a
 * *quote* — an observation, with the store, the zip and the date it was taken.
 * Adopting it writes a *price*, which every other tab costs against. Keeping
 * them apart means a lookup can never quietly overwrite a number you set
 * yourself, and a price always knows where it came from.
 *
 * When a store carries no price for something, that is a row saying so with a
 * box to type your own in — never a blank screen.
 */
export function PriceMapper({ store }: { store: Store }) {
  const {
    foods, prices, priceQuotes, selectedStoreId,
    cacheQuotes, applyQuotes, setPrice,
  } = useApp();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [open, setOpen] = useState(true);

  const gramsFor = (food: Food): number | null => {
    const ref = usdaFor(food);
    return ref ? gramsPerUnit(ref.match.entry, food.unit) : null;
  };
  const source: PriceSource = useMemo(() => krogerSource(gramsFor), []);

  const quotesHere = useMemo(
    () => new Map((priceQuotes ?? []).filter((q) => q.storeId === store.id).map((q) => [q.foodId, q])),
    [priceQuotes, store.id],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .map((food) => {
        const own = prices.find((p) => p.storeId === store.id && p.foodId === food.id);
        return {
          food,
          ingredient: normalizeIngredient(food.name),
          price: own?.pricePerUnit ?? null,
          effective: priceFor(prices, store.id, food.id),
          updatedAt: own?.updatedAt,
          quote: quotesHere.get(food.id),
        };
      })
      .filter((r) => (onlyMissing ? r.price == null : true))
      .sort((a, b) => a.food.name.localeCompare(b.food.name));
  }, [foods, prices, store.id, quotesHere, query, onlyMissing]);

  const stats = useMemo(() => {
    const priced = foods.filter((f) => prices.some((p) => p.storeId === store.id && p.foodId === f.id)).length;
    const quoted = [...quotesHere.values()].filter((q) => q.available).length;
    const stale = [...quotesHere.values()].filter((q) => daysSince(q.lastRefreshed) > MAX_AGE_DAYS).length;
    return { priced, total: foods.length, quoted, stale };
  }, [foods, prices, store.id, quotesHere]);

  /**
   * Refresh from the live source. Anything quoted today is left alone, which
   * is what keeps a page full of ingredients inside the rate limit.
   */
  const refresh = async () => {
    setBusy(true); setError(""); setNote("");
    try {
      if (!(await source.configured())) {
        setError(
          `${source.label} pricing needs server credentials, which this deployment doesn't have. Prices below can still be set by hand, and everything else on this page works.`,
        );
        return;
      }
      if (!store.krogerLocationId) {
        setError(`This store hasn't been matched to a ${source.label} location yet — use Store lookup above.`);
        return;
      }
      const due = rows
        .map((r) => r.food)
        .filter((f) => {
          const q = quotesHere.get(f.id);
          return !q || daysSince(q.lastRefreshed) > MAX_AGE_DAYS;
        });
      if (due.length === 0) {
        setNote("Everything here was already priced today.");
        return;
      }
      const quotes = await source.quote(due, store.krogerLocationId, store.zip || "");
      cacheQuotes(quotes.map((q) => ({ ...q, storeId: store.id })));
      const got = quotes.filter((q) => q.available).length;
      setNote(`Checked ${due.length} ingredients · ${got} priced, ${due.length - got} unavailable.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The price lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  const adopt = () => {
    const n = applyQuotes(store.id);
    setNote(n > 0 ? `Adopted ${n} ${n === 1 ? "price" : "prices"} at ${store.name}.` : "Nothing new to adopt.");
  };

  /** The panel as a table, in the same columns it displays. */
  const exportCsv = () => {
    const head = [
      "Ingredient", "Category", "Quantity unit", "Price per unit", "Store", "Store id",
      "Zip", "Calories per unit", "Source", "Last refreshed",
    ];
    const body = rows.map((r) => [
      r.ingredient,
      FOOD_CATEGORY_LABEL[r.food.category],
      r.food.unit,
      r.price == null ? "" : r.price.toFixed(4),
      store.name,
      store.id,
      store.zip || "",
      String(r.food.caloriesPerUnit),
      r.quote?.source ?? (r.price == null ? "" : "manual"),
      r.updatedAt ?? r.quote?.lastRefreshed ?? "",
    ]);
    download(
      exportName(`prices-${store.name.toLowerCase().replace(/\W+/g, "-")}`, new Date(), "csv"),
      "text/csv",
      [head, ...body].map((cols) => cols.map(csvCell).join(",")).join("\n"),
    );
  };

  return (
    <section className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        Price mapper — {store.name}
        <span className="font-normal normal-case text-faint">
          {stats.priced} of {stats.total} priced
          {stats.quoted > 0 && ` · ${stats.quoted} quoted`}
        </span>
      </button>

      {open && (
        <div className="rounded-2xl card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients…"
                className="field w-full rounded-xl py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <button
              onClick={() => setOnlyMissing((v) => !v)}
              aria-pressed={onlyMissing}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                onlyMissing ? "bg-accent text-on-accent" : "border border-line text-ink-2 hover:bg-surface-3"
              }`}
            >
              Unpriced only
            </button>
            <button
              onClick={refresh}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-3 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh prices
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-3"
            >
              <Download size={14} /> CSV
            </button>
          </div>

          {error && (
            <p className="mb-3 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] leading-4 text-warn-soft">
              <TriangleAlert size={13} className="mt-px shrink-0" /> {error}
            </p>
          )}
          {note && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent bg-accent-wash px-3 py-2 text-[11px] text-accent-soft">
              <span>{note}</span>
              {stats.quoted > 0 && (
                <button onClick={adopt} className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-on-accent hover:brightness-110">
                  Use {stats.quoted} quoted {stats.quoted === 1 ? "price" : "prices"}
                </button>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted">
              <span className="flex-1">Ingredient</span>
              <span className="w-24 text-right">Price / unit</span>
              <span className="hidden w-28 text-right sm:block">Last refreshed</span>
              <span className="hidden w-20 text-right md:block">Source</span>
            </div>

            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">No ingredients match that search.</p>
            ) : (
              rows.slice(0, 200).map((r) => (
                <div key={r.food.id} className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.food.name}</div>
                    <div className="truncate text-[11px] text-muted">
                      {r.food.caloriesPerUnit} cal / {unitLabel(r.food.unit)}
                      {r.quote && !r.quote.available && (
                        <span className="ml-2 text-warn-soft">price unavailable — {r.quote.note}</span>
                      )}
                      {r.quote?.available && r.quote.matchedProduct && (
                        <span className="ml-2 text-sea-soft">matched {r.quote.matchedProduct}</span>
                      )}
                      {!r.quote && r.price == null && r.effective && (
                        <span className="ml-2 text-sea-soft">using base price</span>
                      )}
                    </div>
                  </div>

                  <div className="flex w-24 shrink-0 items-center justify-end gap-1">
                    <span className="text-muted">$</span>
                    <input
                      type="number" min={0} step={0.01} inputMode="decimal"
                      value={r.price ?? ""}
                      placeholder={
                        r.quote?.pricePerUnit != null
                          ? r.quote.pricePerUnit.toFixed(2)
                          : r.effective
                            ? r.effective.pricePerUnit.toFixed(2)
                            : "0.00"
                      }
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setPrice(store.id, r.food.id, v === "" ? null : Math.max(0, Number(v) || 0));
                      }}
                      aria-label={`Price per ${unitLabel(r.food.unit)} of ${r.food.name}`}
                      className="field w-16 rounded-md px-1.5 py-1 text-right text-sm tabular-nums"
                    />
                  </div>

                  <span className="hidden w-28 shrink-0 text-right text-[11px] text-muted sm:block">
                    {r.updatedAt ?? r.quote?.lastRefreshed ?? "never"}
                  </span>
                  <span className="hidden w-20 shrink-0 text-right text-[11px] text-muted md:block">
                    {r.quote?.available ? r.quote.source : r.price != null ? "manual" : "—"}
                  </span>
                </div>
              ))
            )}
          </div>

          {rows.length > 200 && (
            <p className="mt-2 text-center text-[11px] text-muted">
              Showing the first 200 — search to narrow it down.
            </p>
          )}

          <p className="mt-3 text-[11px] leading-4 text-muted">
            Prices here cost your{" "}
            <Link href="/recipes" className="text-accent-soft hover:underline">recipes</Link>,{" "}
            <Link href="/planner" className="text-accent-soft hover:underline">meal plan</Link> and{" "}
            <Link href="/groceries" className="text-accent-soft hover:underline">grocery list</Link>{" "}
            whenever {store.name} is the store being costed against
            {selectedStoreId === store.id ? " — which it is right now." : "."}
          </p>
        </div>
      )}
    </section>
  );
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
