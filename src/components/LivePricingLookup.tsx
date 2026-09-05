"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Link2, Check, TriangleAlert } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { krogerSource } from "@/lib/kroger";
import { usdaFor, gramsPerUnit } from "@/lib/usda";
import { fmtDistance } from "@/lib/geo";
import type { Food, Store } from "@/lib/types";
import type { SourceStore } from "@/lib/pricesource";

/**
 * Store lookup against a live price source.
 *
 * The tab already finds any grocery store near you from the open map data;
 * this finds the ones that can also quote prices, and ties one of them to a
 * store in your list. That link — the source's own location id — is what the
 * Price mapper below needs to ask "what does this cost here".
 *
 * With no credentials on the deployment the panel says so in one line and
 * stays out of the way, because manual pricing is a complete answer on its own.
 */
export function LivePricingLookup() {
  const { stores, home, addStore, updateStore, selectStore } = useApp();
  const [zip, setZip] = useState(home?.zip ?? "");
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<SourceStore[]>([]);

  const gramsFor = (food: Food) => {
    const ref = usdaFor(food);
    return ref ? gramsPerUnit(ref.match.entry, food.unit) : null;
  };
  const source = useMemo(() => krogerSource(gramsFor), []);

  useEffect(() => {
    let alive = true;
    source.configured().then((v) => alive && setReady(v)).catch(() => alive && setReady(false));
    return () => { alive = false; };
  }, [source]);

  const linkedIds = new Set((stores ?? []).map((s) => s.krogerLocationId).filter(Boolean));

  const lookup = async () => {
    setBusy(true); setError(""); setFound([]);
    try {
      setFound(await source.findStores(zip.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The store lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  /** Save it as one of your stores, already tied to the price source. */
  const save = (s: SourceStore) => {
    const existing = (stores ?? []).find(
      (st) => st.name.toLowerCase() === s.name.toLowerCase() && st.zip === s.zip,
    );
    if (existing) {
      updateStore(existing.id, { krogerLocationId: s.locationId, lat: s.lat, lng: s.lng });
      selectStore(existing.id);
      return;
    }
    const store: Store = {
      id: newId(),
      name: s.name,
      address: s.address || undefined,
      city: s.city,
      state: s.state,
      zip: s.zip,
      lat: s.lat,
      lng: s.lng,
      krogerLocationId: s.locationId,
      source: "search",
    };
    addStore(store);
    selectStore(store.id);
  };

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Live pricing · {source.label}
      </h2>

      <div className="rounded-2xl card p-4">
        {ready === false ? (
          <p className="flex items-start gap-2 text-[11px] leading-4 text-muted">
            <TriangleAlert size={13} className="mt-px shrink-0 text-warn-soft" />
            {source.label} pricing is built in but not switched on: it needs
            <code className="mx-1 rounded bg-surface-2 px-1">KROGER_CLIENT_ID</code> and
            <code className="mx-1 rounded bg-surface-2 px-1">KROGER_CLIENT_SECRET</code> on a
            deployment that runs server code. The static site can&apos;t hold a secret, so
            prices here are the ones you set — which every tab already costs against.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-40 flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && zip.trim().length === 5 && lookup()}
                  placeholder="Zip code"
                  inputMode="numeric"
                  maxLength={5}
                  className="field w-full rounded-xl py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <button
                onClick={lookup}
                disabled={busy || zip.trim().length !== 5 || ready === null}
                className="flex items-center gap-1.5 rounded-xl btn-accent px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Find stores
              </button>
            </div>

            {error && (
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-warn-soft">
                <TriangleAlert size={13} className="mt-px shrink-0" /> {error}
              </p>
            )}

            {found.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-line">
                {found.map((s) => {
                  const linked = linkedIds.has(s.locationId);
                  return (
                    <div key={s.locationId} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{s.name}</div>
                        <div className="truncate text-[11px] text-muted">
                          {[s.address, s.city, s.state, s.zip].filter(Boolean).join(", ")}
                        </div>
                      </div>
                      {s.distanceMi != null && (
                        <span className="shrink-0 text-xs tabular-nums text-muted">{fmtDistance(s.distanceMi)}</span>
                      )}
                      <button
                        onClick={() => save(s)}
                        className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                          linked ? "text-accent-soft" : "field hover:brightness-125"
                        }`}
                      >
                        {linked ? <><Check size={13} /> Linked</> : <><Link2 size={13} /> Use for prices</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[11px] leading-4 text-muted">
              Linking a store lets the price mapper below pull its current prices,
              cached for the day rather than fetched per ingredient.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
