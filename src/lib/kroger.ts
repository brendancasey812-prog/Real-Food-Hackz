// The Kroger adapter.
//
// Kroger's API needs an OAuth client secret and does not allow browser
// origins, so none of it can run in the page: every call here goes to this
// app's own /api/kroger/* routes, which hold the credentials and do the
// talking. On the GitHub Pages build those routes do not exist — the workflow
// deletes src/app/api before building — so `configured()` answers false and
// the UI offers manual pricing instead of failing.

import { unavailable, normalizeIngredient, today } from "./pricesource";
import type { PriceQuote, PriceSource, SourceStore } from "./pricesource";
import type { Food, Unit } from "./types";

/** Grams in the units Kroger quotes pack sizes in. */
const GRAMS: Record<string, number> = {
  oz: 28.349523,
  lb: 453.59237,
  g: 1,
  kg: 1000,
};

interface KrogerLocation {
  locationId: string;
  name: string;
  address: { addressLine1?: string; city?: string; state?: string; zipCode?: string };
  geolocation?: { latitude?: number; longitude?: number; };
  distanceMiles?: number;
}

interface KrogerItem {
  price?: { regular?: number; promo?: number };
  size?: string;
}

interface KrogerProduct {
  productId: string;
  description: string;
  items?: KrogerItem[];
}

const api = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`/api/kroger/${path}`, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Kroger request failed (${res.status})`);
  }
  return (await res.json()) as T;
};

/**
 * "32 oz" / "12 fl oz" / "each" → how many of the food's own unit a package
 * holds, so a shelf price becomes a price per unit. Returns null when the two
 * can't be reconciled, which is a normal answer rather than an error.
 */
export function packageInUnits(size: string | undefined, unit: Unit, gramsPerUnit: number | null): number | null {
  if (!size) return unit === "each" ? 1 : null;
  const s = size.toLowerCase().trim();

  // "12 ct" / "each" — a count, only meaningful for foods counted the same way.
  const count = s.match(/^([\d.]+)\s*(ct|count|each|pk|pack)\b/);
  if (count) return unit === "each" ? Number(count[1]) || 1 : null;
  if (s === "each") return unit === "each" ? 1 : null;

  const weight = s.match(/([\d.]+)\s*(oz|lb|lbs|g|kg)\b/);
  if (!weight) return null;
  const grams = Number(weight[1]) * (GRAMS[weight[2] === "lbs" ? "lb" : weight[2]] ?? 0);
  if (!grams) return null;
  if (unit === "oz") return grams / GRAMS.oz;
  if (gramsPerUnit == null || gramsPerUnit <= 0) return null;
  return grams / gramsPerUnit;
}

/** The cheapest current price on a product, promo beating regular. */
function bestPrice(p: KrogerProduct): { price: number; size?: string } | null {
  for (const item of p.items ?? []) {
    const price = item.price?.promo || item.price?.regular;
    if (price && price > 0) return { price, size: item.size };
  }
  return null;
}

/**
 * Build the adapter. `gramsFor` is injected rather than imported so the
 * conversion table (USDA) stays the caller's business.
 */
export function krogerSource(
  gramsFor: (food: Food) => number | null,
): PriceSource {
  return {
    id: "kroger",
    label: "Kroger",

    configured: async () => {
      // The static export has no API routes at all, so don't even ask.
      if (process.env.NEXT_PUBLIC_SERVER_AI !== "1") return false;
      try {
        const r = await api<{ configured: boolean }>("status");
        return Boolean(r.configured);
      } catch {
        return false;
      }
    },

    findStores: async (zip, signal) => {
      const r = await api<{ data?: KrogerLocation[] }>(
        `locations?zip=${encodeURIComponent(zip)}`,
        signal,
      );
      return (r.data ?? []).map(
        (l): SourceStore => ({
          locationId: l.locationId,
          name: l.name,
          address: l.address?.addressLine1 ?? "",
          city: l.address?.city ?? "",
          state: l.address?.state ?? "",
          zip: l.address?.zipCode ?? zip,
          distanceMi: l.distanceMiles,
          lat: l.geolocation?.latitude,
          lng: l.geolocation?.longitude,
        }),
      );
    },

    quote: async (foods, locationId, zip, signal) => {
      const out: PriceQuote[] = [];
      for (const food of foods) {
        const term = normalizeIngredient(food.name);
        try {
          const r = await api<{ data?: KrogerProduct[] }>(
            `products?term=${encodeURIComponent(term)}&locationId=${encodeURIComponent(locationId)}`,
            signal,
          );
          const product = (r.data ?? []).map((p) => ({ p, best: bestPrice(p) })).find((x) => x.best);
          if (!product || !product.best) {
            out.push(unavailable(food, locationId, zip, "kroger", "No priced product at this store"));
            continue;
          }
          const held = packageInUnits(product.best.size, food.unit, gramsFor(food));
          if (held == null || held <= 0) {
            out.push({
              ...unavailable(food, locationId, zip, "kroger", `Pack size "${product.best.size ?? "unknown"}" doesn't convert to ${food.unit}`),
              packagePrice: product.best.price,
              packageSize: product.best.size,
              matchedProduct: product.p.description,
            });
            continue;
          }
          out.push({
            foodId: food.id,
            ingredient: term,
            pricePerUnit: Math.round((product.best.price / held) * 1e4) / 1e4,
            unit: food.unit,
            packagePrice: product.best.price,
            packageSize: product.best.size,
            matchedProduct: product.p.description,
            storeId: locationId,
            zip,
            lastRefreshed: today(),
            source: "kroger",
            available: true,
          });
        } catch (e) {
          out.push(
            unavailable(
              food,
              locationId,
              zip,
              "kroger",
              e instanceof Error ? e.message : "Lookup failed",
            ),
          );
        }
      }
      return out;
    },
  };
}
