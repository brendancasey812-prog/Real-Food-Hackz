"use client";

import { useRef, useState } from "react";
import { Store as StoreIcon, Search, Crosshair, Loader2, Plus, X, Check } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import {
  geocode, nearbyStores, currentPosition, geoMessage, fmtDistance,
  type NearbyStore,
} from "@/lib/geo";
import { BASE_STORE_ID } from "@/lib/cost";
import type { Store } from "@/lib/types";

/**
 * Choosing which store a set of prices belongs to — including one you haven't
 * saved yet.
 *
 * The Stores tab can find real shops near you, and needing that only there
 * meant leaving a half-finished receipt to go and add the shop you are
 * standing in. So the search lives here too: find it nearby, or just name it.
 * Either way the store is created and selected in one step.
 */
export function StorePicker({
  value, onChange,
}: {
  value: string;
  onChange: (storeId: string) => void;
}) {
  const { stores, home, addStore, setHome } = useApp();
  const [adding, setAdding] = useState(false);
  const [where, setWhere] = useState(home?.zip || [home?.city, home?.state].filter(Boolean).join(", "));
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  const [error, setError] = useState("");
  const [found, setFound] = useState<NearbyStore[]>([]);
  const [manualName, setManualName] = useState("");
  const abort = useRef<AbortController | null>(null);

  const saved = new Set(stores.map((s) => `${s.name.toLowerCase()}|${(s.zip ?? "").trim()}`));

  const searchAround = async (at: { lat: number; lng: number }) => {
    abort.current?.abort();
    abort.current = new AbortController();
    setFound(await nearbyStores(at, 8, abort.current.signal));
  };

  const searchByPlace = async () => {
    setBusy("search"); setError(""); setFound([]);
    try {
      const hit = await geocode(where.trim());
      if (!hit) {
        setError("Couldn't find that place — try a ZIP code or “City, ST”.");
        return;
      }
      setHome({ lat: hit.lat, lng: hit.lng });
      await searchAround(hit);
    } catch (e) {
      setError(geoMessage(e, "The store search failed."));
    } finally {
      setBusy(null);
    }
  };

  const searchHere = async () => {
    setBusy("locate"); setError(""); setFound([]);
    try {
      const at = await currentPosition();
      setHome({ lat: at.lat, lng: at.lng });
      await searchAround(at);
    } catch (e) {
      setError(geoMessage(e));
    } finally {
      setBusy(null);
    }
  };

  /** Save a found shop and cost against it straight away. */
  const save = (c: NearbyStore) => {
    const store: Store = {
      id: newId(),
      name: c.name,
      address: c.address,
      city: c.city ?? "",
      state: c.state ?? "",
      zip: c.zip ?? "",
      lat: c.lat,
      lng: c.lng,
      source: "search",
    };
    addStore(store);
    onChange(store.id);
    setAdding(false);
    setFound([]);
  };

  /** No search, no address — just a name, which is enough to hold prices. */
  const saveByName = () => {
    const name = manualName.trim();
    if (!name) return;
    const store: Store = { id: newId(), name, city: "", state: "", zip: "", source: "manual" };
    addStore(store);
    onChange(store.id);
    setAdding(false);
    setManualName("");
  };

  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <StoreIcon size={15} className="shrink-0 text-muted" />
        <span className="text-sm text-ink-2">Shopped at</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value={BASE_STORE_ID}>Base prices (any store)</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ""}</option>
          ))}
        </select>
        <button
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            adding ? "bg-accent text-on-accent" : "border border-line text-ink-2 hover:bg-surface-3"
          }`}
        >
          {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "Cancel" : "Add store"}
        </button>
      </div>

      {adding && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && where.trim() && searchByPlace()}
                placeholder="ZIP, or City, ST"
                className="field w-full rounded-lg py-1.5 pl-8 pr-2 text-sm"
              />
            </div>
            <button
              onClick={searchByPlace}
              disabled={busy != null || !where.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3 disabled:opacity-40"
            >
              {busy === "search" ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Find nearby
            </button>
            <button
              onClick={searchHere}
              disabled={busy != null}
              title="Use my location"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3 disabled:opacity-40"
            >
              {busy === "locate" ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
            </button>
          </div>

          {error && <p className="mt-2 text-[11px] text-warn-soft">{error}</p>}

          {found.length > 0 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
              {found.slice(0, 12).map((c) => {
                const already = saved.has(`${c.name.toLowerCase()}|${(c.zip ?? "").trim()}`);
                return (
                  <div key={c.osmId} className="flex items-center gap-2 border-b border-line px-2.5 py-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c.name}</div>
                      <div className="truncate text-[11px] text-muted">
                        {[c.address, c.city, c.state].filter(Boolean).join(", ") || c.kind}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">
                      {fmtDistance(c.distanceMi)}
                    </span>
                    <button
                      onClick={() => save(c)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                        already ? "text-muted" : "field hover:brightness-125"
                      }`}
                    >
                      {already ? <Check size={12} /> : "Use"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* A shop the map doesn't know is still a shop. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveByName()}
              placeholder="…or just type the store's name"
              className="field min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm"
            />
            <button
              onClick={saveByName}
              disabled={!manualName.trim()}
              className="shrink-0 rounded-lg btn-accent px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Add
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-4 text-muted">
            Store data © OpenStreetMap contributors.
          </p>
        </div>
      )}
    </div>
  );
}
