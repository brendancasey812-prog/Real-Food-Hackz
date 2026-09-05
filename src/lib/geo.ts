// Geography helpers for the Stores tab.
//
// Two free, key-less services are used, both called straight from the browser:
//   - Nominatim (OpenStreetMap) turns "Austin, TX 78704" into coordinates.
//   - Overpass turns a coordinate + radius into the real supermarkets around it.
//
// Both are best-effort. Every caller here degrades to "add the store by hand",
// because a locator that hard-fails when a public API is slow is worse than one
// that quietly lets you type an address.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoError {
  kind: "network" | "empty" | "http";
  message: string;
}

const EARTH_MI = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles between two points. */
export function distanceMi(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.sqrt(h));
}

/** "1.2 mi" / "480 ft" for short hops. */
export function fmtDistance(mi: number): string {
  if (mi < 0.19) return `${Math.round(mi * 5280)} ft`;
  return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
}

/** Build the one-line query Nominatim understands from address parts. */
export function addressQuery(parts: {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string {
  return [parts.address, parts.city, parts.state, parts.zip]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export interface GeocodeHit extends LatLng {
  /** The full name Nominatim matched, e.g. "78704, Travis County, Texas". */
  label: string;
}

/**
 * Turn a free-text place (city/state/zip, or a full street address) into
 * coordinates. Returns null when nothing matched; throws GeoError on network
 * or HTTP failure so the caller can tell "not found" from "couldn't reach it".
 */
export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${NOMINATIM}?format=jsonv2&limit=1&addressdetails=0&countrycodes=us&q=${encodeURIComponent(q)}`;

  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw { kind: "network", message: "Couldn't reach the address lookup service." } as GeoError;
  }
  if (!res.ok) {
    throw { kind: "http", message: `Address lookup failed (HTTP ${res.status}).` } as GeoError;
  }
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!rows.length) return null;
  return {
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon),
    label: rows[0].display_name
  };
}

const OVERPASS = "https://overpass-api.de/api/interpreter";

export interface NearbyStore extends LatLng {
  /** OSM element id, stable enough to de-duplicate a repeated search. */
  osmId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** supermarket / grocery / greengrocer / wholesale. */
  kind: string;
  distanceMi: number;
}

interface OverpassEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Find real grocery stores within `radiusMi` of a point, nearest first.
 * Unnamed shops are dropped — an unnamed pin isn't something you can shop at.
 */
export async function nearbyStores(
  at: LatLng,
  radiusMi = 8,
  signal?: AbortSignal,
): Promise<NearbyStore[]> {
  const meters = Math.round(radiusMi * 1609.34);
  const filter = '["shop"~"^(supermarket|grocery|greengrocer|wholesale)$"]';
  const query = `[out:json][timeout:25];(node${filter}(around:${meters},${at.lat},${at.lng});way${filter}(around:${meters},${at.lat},${at.lng}););out center tags 60;`;

  let res: Response;
  try {
    res = await fetch(OVERPASS, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw { kind: "network", message: "Couldn't reach the store search service." } as GeoError;
  }
  if (!res.ok) {
    throw { kind: "http", message: `Store search failed (HTTP ${res.status}).` } as GeoError;
  }

  const data = (await res.json()) as { elements?: OverpassEl[] };
  const out: NearbyStore[] = [];
  for (const el of data.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (lat == null || lng == null || !name) continue;
    const t = el.tags ?? {};
    out.push({
      osmId: `${el.type}/${el.id}`,
      name,
      address: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || undefined,
      city: t["addr:city"],
      state: t["addr:state"],
      zip: t["addr:postcode"],
      kind: t.shop ?? "supermarket",
      lat,
      lng,
      distanceMi: distanceMi(at, { lat, lng })
    });
  }
  // De-duplicate chains that map both a node and a building way at one site.
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .filter((s) => {
      const key = `${s.name}@${s.lat.toFixed(3)},${s.lng.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Browser geolocation as a promise, so "use my location" reads linearly. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ kind: "network", message: "This browser has no location support." } as GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject({
          kind: "network",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — enter a ZIP instead."
              : "Couldn't get your location — enter a ZIP instead."
        } as GeoError),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

/** Narrow an unknown catch value to something with a readable message. */
export function geoMessage(e: unknown, fallback = "Something went wrong."): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as GeoError).message === "string") {
    return (e as GeoError).message;
  }
  return fallback;
}
