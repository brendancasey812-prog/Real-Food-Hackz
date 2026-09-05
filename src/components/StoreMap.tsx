"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker, LayerGroup } from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  /** Renders as the accent pin — the store the app is costing against. */
  selected?: boolean;
  /** A search result you haven't saved yet, drawn hollow. */
  candidate?: boolean;
}

interface Props {
  markers: MapMarker[];
  /** Where the user is searching from; drawn as a small "you" dot. */
  origin?: { lat: number; lng: number } | null;
  onMarkerClick?: (id: string) => void;
  heightClass?: string;
}

/**
 * OpenStreetMap view of the stores.
 *
 * Leaflet touches `window` at import time, so it is pulled in lazily inside the
 * effect rather than at module scope — that keeps the static export's
 * prerender pass working. Pins are `divIcon`s (inline HTML) instead of
 * Leaflet's default PNG markers, which sidesteps the broken image paths you
 * otherwise get under a GitHub Pages `basePath`.
 */
export function StoreMap({ markers, origin, onMarkerClick, heightClass = "h-72 md:h-96" }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const clickRef = useRef(onMarkerClick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep the latest click handler reachable from Leaflet's own listeners
  // without tearing down and rebuilding every marker when it changes.
  useEffect(() => {
    clickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current || map.current) return;

      const m = L.map(holder.current, {
        center: [39.5, -98.35], // continental US, until we know better
        zoom: 4,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      })
        .on("tileerror", () => setFailed(true))
        .addTo(m);

      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
      // The container animates in; tell Leaflet to re-measure once settled.
      setTimeout(() => m.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Redraw pins whenever the markers change.
  useEffect(() => {
    if (!ready || !map.current || !layer.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !layer.current || !map.current) return;
      layer.current.clearLayers();

      const pin = (mk: MapMarker) => {
        const fill = mk.selected ? "#10b981" : mk.candidate ? "transparent" : "#38bdf8";
        const stroke = mk.selected ? "#065f46" : mk.candidate ? "#38bdf8" : "#0c4a6e";
        return L.divIcon({
          className: "",
          html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${fill};border:2.5px solid ${stroke};box-shadow:0 0 0 3px rgba(0,0,0,.35),0 4px 10px rgba(0,0,0,.5)"></span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
      };

      const pts: [number, number][] = [];
      for (const mk of markers) {
        const marker: Marker = L.marker([mk.lat, mk.lng], { icon: pin(mk), title: mk.label });
        marker.bindTooltip(
          `<strong>${escapeHtml(mk.label)}</strong>${mk.sub ? `<br>${escapeHtml(mk.sub)}` : ""}`,
          { direction: "top", offset: [0, -12] },
        );
        marker.on("click", () => clickRef.current?.(mk.id));
        marker.addTo(layer.current!);
        pts.push([mk.lat, mk.lng]);
      }

      if (origin) {
        L.circleMarker([origin.lat, origin.lng], {
          radius: 6,
          color: "#fbbf24",
          weight: 2,
          fillColor: "#fbbf24",
          fillOpacity: 0.9
        })
          .bindTooltip("Searching from here", { direction: "top", offset: [0, -8] })
          .addTo(layer.current!);
        pts.push([origin.lat, origin.lng]);
      }

      if (pts.length === 1) map.current.setView(pts[0], 13);
      else if (pts.length > 1) map.current.fitBounds(L.latLngBounds(pts).pad(0.25));
    })();

    return () => {
      cancelled = true;
    };
  }, [markers, origin, ready]);

  return (
    <div className={`relative overflow-hidden rounded-2xl card ${heightClass}`}>
      <div ref={holder} className="h-full w-full bg-page" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
          Loading map…
        </div>
      )}
      {failed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-scrim px-3 py-2 text-center text-[11px] text-warn-soft">
          Map tiles couldn&apos;t load — the store list below still works.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
