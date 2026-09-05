"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MapPin, Crosshair, Search, Plus, Trash2, Check, LocateFixed,
  TriangleAlert, Store as StoreIcon, X
} from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { BASE_STORE_ID, priceFor, fmtMoney, plannedCost } from "@/lib/cost";
import {
  geocode, nearbyStores, currentPosition, distanceMi, fmtDistance,
  addressQuery, geoMessage, type LatLng, type NearbyStore
} from "@/lib/geo";
import { weekDays, isoOf } from "@/lib/week";
import type { Store } from "@/lib/types";
import type { MapMarker } from "@/components/StoreMap";
import { SettingsButton } from "@/components/SettingsButton";

// Leaflet is browser-only; keep it out of the export's prerender pass entirely.
const StoreMap = dynamic(() => import("@/components/StoreMap").then((m) => m.StoreMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-2xl card text-sm text-muted md:h-96">
      Loading map…
    </div>
  )
});

const BLANK = { name: "", address: "", city: "", state: "", zip: "" };

export default function Stores() {
  const {
    stores, prices, foods, recipes, plan, selectedStoreId, home,
    addStore, updateStore, removeStore, selectStore, setHome, seedStorePricesFromBase
  } = useApp();

  const [origin, setOrigin] = useState<LatLng | null>(
    home.lat != null && home.lng != null ? { lat: home.lat, lng: home.lng } : null,
  );
  const [where, setWhere] = useState(
    [home.city, home.state, home.zip].filter(Boolean).join(" ").trim(),
  );
  const [busy, setBusy] = useState<"locating" | "searching" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<NearbyStore[]>([]);
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const abort = useRef<AbortController | null>(null);

  const savedKeys = useMemo(
    () => new Set(stores.map((s) => `${s.name.toLowerCase()}|${(s.zip || "").trim()}`)),
    [stores],
  );

  /** Resolve the typed city/state/zip into a coordinate we can search around. */
  const resolveOrigin = async (): Promise<LatLng | null> => {
    if (!where.trim()) {
      setError("Enter a city, state or ZIP first — or use your current location.");
      return null;
    }
    const hit = await geocode(where);
    if (!hit) {
      setError(`Couldn't find "${where}". Try a ZIP code, or "City, ST".`);
      return null;
    }
    setOrigin(hit);
    // Remember roughly where the user shops, so this survives a reload.
    const zip = where.match(/\b\d{5}\b/)?.[0] ?? "";
    setHome({ city: home.city, state: home.state, zip: zip || home.zip, lat: hit.lat, lng: hit.lng });
    return hit;
  };

  const findNearby = async () => {
    setError(null);
    setNote(null);
    setBusy("searching");
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const at = origin && !where.trim() ? origin : await resolveOrigin();
      if (!at) return;
      const found = await nearbyStores(at, 8, abort.current.signal);
      setCandidates(found);
      setNote(
        found.length
          ? `Found ${found.length} grocery ${found.length === 1 ? "store" : "stores"} within 8 miles.`
          : "No grocery stores mapped within 8 miles. Try a wider area, or add one by hand.",
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(`${geoMessage(e)} You can still add a store by hand below.`);
    } finally {
      setBusy(null);
    }
  };

  const useMyLocation = async () => {
    setError(null);
    setBusy("locating");
    try {
      const at = await currentPosition();
      setOrigin(at);
      setWhere("");
      setHome({ lat: at.lat, lng: at.lng });
      setNote("Using your current location.");
    } catch (e) {
      setError(geoMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const saveCandidate = (c: NearbyStore) => {
    const store: Store = {
      id: newId(),
      name: c.name,
      address: c.address,
      city: c.city ?? "",
      state: c.state ?? "",
      zip: c.zip ?? "",
      lat: c.lat,
      lng: c.lng,
      source: "search"
    };
    addStore(store);
    setCandidates((list) => list.filter((x) => x.osmId !== c.osmId));
  };

  const submitForm = async () => {
    if (!form || !form.name.trim()) return;
    const id = newId();
    const store: Store = {
      id,
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      source: "manual"
    };
    addStore(store);
    setForm(null);
    // Best-effort geocode so it lands on the map; failure is fine.
    const q = addressQuery(store);
    if (q) {
      try {
        const hit = await geocode(q);
        if (hit) updateStore(id, { lat: hit.lat, lng: hit.lng });
      } catch {
        /* keep the store; it just won't have a pin until located */
      }
    }
  };

  const locateStore = async (s: Store) => {
    setError(null);
    const q = addressQuery(s);
    if (!q) {
      setError(`${s.name} needs a city, state or ZIP before it can be placed on the map.`);
      return;
    }
    try {
      const hit = await geocode(q);
      if (!hit) setError(`Couldn't place ${s.name} from "${q}".`);
      else updateStore(s.id, { lat: hit.lat, lng: hit.lng });
    } catch (e) {
      setError(geoMessage(e));
    }
  };

  const pick = (id: string) => {
    selectStore(id);
    const n = seedStorePricesFromBase(id);
    setNote(
      n > 0
        ? `Now costing against this store — ${n} base prices copied over as a starting point.`
        : "Now costing against this store.",
    );
  };

  const week = weekDays(new Date()).map(isoOf);
  const weekMeals = plan.filter((m) => week.includes(m.date));

  const withDistance = useMemo(
    () =>
      stores
        .map((s) => ({
          store: s,
          dist:
            origin && s.lat != null && s.lng != null
              ? distanceMi(origin, { lat: s.lat, lng: s.lng })
              : null,
          coverage: foods.filter((f) => priceFor(prices, s.id, f.id) !== null).length,
          week: plannedCost(weekMeals, recipes, prices, s.id)
        }))
        .sort((a, b) => {
          if (a.dist == null && b.dist == null) return a.store.name.localeCompare(b.store.name);
          if (a.dist == null) return 1;
          if (b.dist == null) return -1;
          return a.dist - b.dist;
        }),
    [stores, origin, foods, prices, recipes, weekMeals],
  );

  const markers: MapMarker[] = useMemo(() => {
    const saved: MapMarker[] = stores
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        id: s.id,
        lat: s.lat!,
        lng: s.lng!,
        label: s.name,
        sub: [s.address, s.city, s.state].filter(Boolean).join(", ") || undefined,
        selected: s.id === selectedStoreId
      }));
    const found: MapMarker[] = candidates.map((c) => ({
      id: `cand:${c.osmId}`,
      lat: c.lat,
      lng: c.lng,
      label: c.name,
      sub: `${fmtDistance(c.distanceMi)} away — click to save`,
      candidate: true
    }));
    return [...saved, ...found];
  }, [stores, candidates, selectedStoreId]);

  const onMarker = (id: string) => {
    if (id.startsWith("cand:")) {
      const c = candidates.find((x) => `cand:${x.osmId}` === id);
      if (c) saveCandidate(c);
    } else {
      pick(id);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Stores</h1>
          <p className="mt-1 text-sm text-muted">
            Find the stores near you, then pick one — every cost in the app re-prices against it.
          </p>
        </div>
        <SettingsButton className="hidden md:flex" />
      </header>

      {/* --- Map at the top --- */}
      <StoreMap markers={markers} origin={origin} onMarkerClick={onMarker} />

      {/* --- Where are you shopping --- */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findNearby()}
            placeholder="City, ST or ZIP — e.g. Austin, TX or 78704"
            className="field w-full rounded-xl py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <button
          onClick={findNearby}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl btn-accent px-4 py-2.5 text-sm disabled:opacity-60"
        >
          <MapPin size={15} />
          {busy === "searching" ? "Searching…" : "Find stores"}
        </button>
        <button
          onClick={useMyLocation}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm field hover:brightness-125 disabled:opacity-60"
        >
          <Crosshair size={15} />
          {busy === "locating" ? "Locating…" : "Use my location"}
        </button>
        <button
          onClick={() => setForm(BLANK)}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm field hover:brightness-125"
        >
          <Plus size={15} /> Add manually
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/12 px-3 py-2.5 text-sm text-warn-soft">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {note && !error && (
        <p className="mt-3 rounded-xl border border-accent bg-accent-wash px-3 py-2.5 text-sm text-accent-soft">
          {note}
        </p>
      )}

      {/* --- Manual add form --- */}
      {form && (
        <div className="mt-4 rounded-2xl card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Add a store</h2>
            <button onClick={() => setForm(null)} className="rounded-lg p-1 text-muted hover:text-ink">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Store name" className="field col-span-2 rounded-xl px-3 py-2 text-sm md:col-span-2" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street (optional)" className="field col-span-2 rounded-xl px-3 py-2 text-sm" />
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="City" className="field rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="ST" maxLength={2} className="field rounded-xl px-3 py-2 text-sm" />
              <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })}
                placeholder="ZIP" className="field rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={submitForm} disabled={!form.name.trim()}
              className="rounded-xl btn-accent px-4 py-2 text-sm disabled:opacity-50">
              Save store
            </button>
            <span className="text-[11px] text-muted">
              We&apos;ll try to place it on the map from the address.
            </span>
          </div>
        </div>
      )}

      {/* --- Nearby search results --- */}
      {candidates.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Nearby — closest first
          </h2>
          <div className="overflow-hidden rounded-2xl card">
            {candidates.slice(0, 12).map((c) => {
              const already = savedKeys.has(`${c.name.toLowerCase()}|${(c.zip || "").trim()}`);
              return (
                <div key={c.osmId} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                                    <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{c.name}</div>
                    <div className="truncate text-[11px] text-muted">
                      {[c.address, c.city, c.state, c.zip].filter(Boolean).join(", ") || c.kind}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {fmtDistance(c.distanceMi)}
                  </span>
                  <button
                    onClick={() => saveCandidate(c)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      already ? "text-muted" : "field hover:brightness-125"
                    }`}
                  >
                    {already ? "Saved" : "Save"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- Your stores --- */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Your stores
        </h2>

        {/* Base prices always exist, so there is always something to cost against. */}
        <button
          onClick={() => selectStore(BASE_STORE_ID)}
          className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition card card-hover ${
            selectedStoreId === BASE_STORE_ID ? "ring-1 ring-accent" : ""
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
            <StoreIcon size={16} className="text-ink-2" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm">Base prices</div>
            <div className="text-[11px] text-muted">
              Your typical prices — the fallback for any store you haven&apos;t priced
            </div>
          </div>
          {selectedStoreId === BASE_STORE_ID && (
            <span className="flex items-center gap-1 text-xs text-accent-soft">
              <Check size={14} /> Costing
            </span>
          )}
        </button>

        {withDistance.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-2 py-12 text-center text-sm text-muted">
            No stores yet — search above to pull in the ones near you, or add one by hand.
          </div>
        ) : (
          <div className="space-y-2">
            {withDistance.map(({ store: s, dist, coverage, week: cost }) => {
              const active = s.id === selectedStoreId;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition card ${
                    active ? "ring-1 ring-accent" : "card-hover"
                  }`}
                >
                  <button onClick={() => pick(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{s.name}</div>
                      <div className="truncate text-[11px] text-muted">
                        {[s.address, s.city, s.state, s.zip].filter(Boolean).join(", ") || "No address yet"}
                        {s.lat == null && " · not on map"}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="text-xs tabular-nums text-ink-2">
                        {cost.priced > 0 ? fmtMoney(cost.cost) : "—"}
                      </div>
                      <div className="text-[10px] text-muted">this week</div>
                    </div>
                    {dist != null && (
                      <span className="shrink-0 text-xs tabular-nums text-muted">{fmtDistance(dist)}</span>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {active ? (
                      <span className="flex items-center gap-1 pr-1 text-xs text-accent-soft">
                        <Check size={14} /> Costing
                      </span>
                    ) : (
                      <span className="pr-1 text-[11px] text-muted">{coverage} priced</span>
                    )}
                    {s.lat == null && (
                      <button onClick={() => locateStore(s)} title="Place on map"
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-ink">
                        <LocateFixed size={15} />
                      </button>
                    )}
                    <button onClick={() => removeStore(s.id)} title="Remove store"
                      className="rounded-lg p-1.5 text-faint hover:bg-surface-3 hover:text-danger-soft">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-muted">
        Prices live in the{" "}
        <Link href="/costs" className="text-accent-soft hover:underline">
          Cost repository
        </Link>
        . Store data &copy; OpenStreetMap contributors.
      </p>
    </div>
  );
}
