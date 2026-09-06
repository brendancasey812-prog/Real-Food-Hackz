"use client";

import { useState } from "react";
import { Search, Loader2, KeyRound, ExternalLink } from "lucide-react";
import { searchFdc, fdcPerUnit, fdcKey, setFdcKey, FdcError, type FdcResult } from "@/lib/fdc";
import { unitLabel } from "@/lib/units";
import type { Food } from "@/lib/types";

/**
 * Looking a food up in the whole of FoodData Central, rather than the 323
 * records the app ships.
 *
 * The bundled table is deliberately small — it has to load on a phone — so it
 * covers staples and misses the long tail. This reaches the real database for
 * everything else. It needs the user's own free key, which is why the panel
 * asks for one rather than pretending the feature is broken.
 */
export function FdcLookup({
  food, onApply,
}: {
  food: Food;
  onApply: (n: { caloriesPerUnit: number; protein: number; carbs: number; fat: number }, fdcId: number) => void;
}) {
  // Read on first render rather than in an effect: the key is already there,
  // and a flash of the "add a key" panel would be a lie.
  const [key, setKey] = useState(() => fdcKey());
  const [query, setQuery] = useState(food.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<FdcResult[] | null>(null);

  const run = async () => {
    setBusy(true); setError(""); setResults(null);
    try {
      setResults(await searchFdc(query.trim(), key.trim()));
    } catch (e) {
      setError(e instanceof FdcError ? e.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Look it up in FoodData Central
      </p>

      {!key && (
        <div className="mt-2">
          <label className="flex items-center gap-2 text-[11px] text-muted">
            <KeyRound size={12} className="shrink-0" />
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setFdcKey(e.target.value); }}
              placeholder="Your free FoodData Central API key"
              className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
            />
          </label>
          <p className="mt-1.5 text-[10px] leading-4 text-muted">
            Free and instant from{" "}
            <a
              href="https://fdc.nal.usda.gov/api-key-signup.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-accent-soft hover:underline"
            >
              fdc.nal.usda.gov <ExternalLink size={9} />
            </a>
            . Kept in this browser, sent only to USDA.
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && run()}
          placeholder="Search FoodData Central…"
          className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
        />
        <button
          onClick={run}
          disabled={busy || !query.trim() || !key.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3 disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          Search
        </button>
      </div>

      {error && <p className="mt-2 text-[11px] text-warn-soft">{error}</p>}

      {results?.length === 0 && (
        <p className="mt-2 text-[11px] text-muted">Nothing in FoodData Central matched that.</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {results.map((r) => {
            const n = fdcPerUnit(r, food.unit);
            return (
              <div key={r.fdcId} className="rounded-lg border border-line bg-page px-2.5 py-2">
                <div className="truncate text-[11px] text-ink-2" title={r.description}>
                  {r.description}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted">
                    {n
                      ? `${n.caloriesPerUnit} cal / ${unitLabel(food.unit)} · ${n.protein}p ${n.carbs}c ${n.fat}f`
                      : `${r.calories} cal / 100 g — no ${unitLabel(food.unit)} weight published`}
                  </span>
                  <button
                    onClick={() => n && onApply(n, r.fdcId)}
                    disabled={!n}
                    className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[10px] font-medium text-on-accent hover:brightness-110 disabled:opacity-30"
                  >
                    Use
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
