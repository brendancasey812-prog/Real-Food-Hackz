"use client";

import { useMemo, useState } from "react";
import { Search, Loader2, KeyRound, ExternalLink, Globe } from "lucide-react";
import { searchUsda, unitNutrition } from "@/lib/usda";
import { searchFdc, fdcPerUnit, fdcKey, setFdcKey, FdcError, type FdcResult } from "@/lib/fdc";
import { unitLabel } from "@/lib/units";
import type { FoodCategory, Unit } from "@/lib/types";

export interface Nutrition {
  caloriesPerUnit: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Finding a food's real numbers instead of guessing them.
 *
 * Two sources, in the order you'd want them. The table the app ships answers
 * instantly, offline, with no key — it holds 323 analysed foods and covers
 * most of a kitchen. FoodData Central holds the rest and needs the user's own
 * free key, so it is offered rather than assumed.
 *
 * Both are shown as candidates rather than applied silently: "Lettuce, cos or
 * romaine, raw" and "Lettuce, iceberg, raw" are one word apart and a hundred
 * calories apart, and only the person holding the lettuce knows which it is.
 */
export function NutritionLookup({
  name, unit, category, onApply, compact = false,
}: {
  name: string;
  unit: Unit;
  /** Lets a cup of something convert when FDC never weighed one. */
  category?: FoodCategory;
  onApply: (n: Nutrition, fdcId: number) => void;
  /** Drop the surrounding card, for use inside a form that already has one. */
  compact?: boolean;
}) {
  const [key, setKey] = useState(() => fdcKey());
  const [query, setQuery] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remote, setRemote] = useState<FdcResult[] | null>(null);

  // The bundled table needs no request, so it answers as you type.
  const local = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return searchUsda(q, 5).map((match) => ({
      match,
      per: unitNutrition(match.entry, unit, { category }),
    }));
  }, [query, unit, category]);

  const run = async () => {
    setBusy(true); setError(""); setRemote(null);
    try {
      setRemote(await searchFdc(query.trim(), key.trim()));
    } catch (e) {
      setError(e instanceof FdcError ? e.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  const Row = ({
    label, detail, nutrition, onUse, disabled,
  }: {
    label: string;
    detail: string;
    nutrition: Nutrition | null;
    onUse: () => void;
    disabled?: boolean;
  }) => (
    <div className="rounded-lg border border-line bg-page px-2.5 py-2">
      <div className="truncate text-[11px] text-ink-2" title={label}>{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted">{detail}</span>
        <button
          onClick={onUse}
          disabled={disabled || !nutrition}
          className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[10px] font-medium text-on-accent hover:brightness-110 disabled:opacity-30"
        >
          Use
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && key.trim() && !busy && run()}
            placeholder="Search foods…"
            className="field w-full rounded-lg py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
      </div>

      {local.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {local.map(({ match, per }) => (
            <Row
              key={match.entry.id}
              label={match.entry.n}
              detail={
                per
                  ? `${per.nutrition.caloriesPerUnit} cal / ${unitLabel(unit)} · ${per.nutrition.protein}p ${per.nutrition.carbs}c ${per.nutrition.fat}f${per.estimated ? " · est." : ""}`
                  : `${match.entry.k} cal / 100 g — no ${unitLabel(unit)} weight to convert by`
              }
              nutrition={per?.nutrition ?? null}
              onUse={() => per && onApply(per.nutrition, match.entry.id)}
            />
          ))}
        </div>
      )}

      {query.trim().length >= 2 && local.length === 0 && (
        <p className="mt-2 text-[11px] text-muted">
          Nothing in the bundled table. Search the full database below.
        </p>
      )}

      {/* The rest of FoodData Central, on the user's own key. */}
      <div className="mt-3 border-t border-line pt-2.5">
        {!key ? (
          <>
            <label className="flex items-center gap-2">
              <KeyRound size={12} className="shrink-0 text-muted" />
              <input
                type="password"
                value={key}
                onChange={(e) => { setKey(e.target.value); setFdcKey(e.target.value); }}
                placeholder="Free FoodData Central API key"
                className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
              />
            </label>
            <p className="mt-1.5 text-[10px] leading-4 text-muted">
              Adds the other few hundred thousand foods. Free and instant from{" "}
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
          </>
        ) : (
          <button
            onClick={run}
            disabled={busy || !query.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-[11px] font-medium text-ink-2 hover:bg-surface-3 disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
            Search all of FoodData Central
          </button>
        )}

        {error && <p className="mt-2 text-[11px] text-warn-soft">{error}</p>}
        {remote?.length === 0 && (
          <p className="mt-2 text-[11px] text-muted">Nothing there matched either.</p>
        )}
        {remote && remote.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {remote.map((r) => {
              const n = fdcPerUnit(r, unit);
              return (
                <Row
                  key={r.fdcId}
                  label={r.description}
                  detail={
                    n
                      ? `${n.caloriesPerUnit} cal / ${unitLabel(unit)} · ${n.protein}p ${n.carbs}c ${n.fat}f`
                      : `${r.calories} cal / 100 g — no ${unitLabel(unit)} weight published`
                  }
                  nutrition={n}
                  onUse={() => n && onApply(n, r.fdcId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  if (compact) return <div>{body}</div>;
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Look up the numbers
      </p>
      {body}
    </div>
  );
}
