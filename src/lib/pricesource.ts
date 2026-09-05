// Where a price can come from, behind one interface.
//
// The app has always priced food from numbers you typed in. A live source —
// a chain's product API — answers the same question differently, so both sit
// behind this shape and the UI never has to care which one answered. Adding a
// second chain later is one more object in SOURCES.
//
// Every quote carries where and when it came from, because a price without a
// store and a date is not a fact about anything.

import type { Food, PriceQuote, PriceSourceId } from "./types";

export type { PriceQuote, PriceSourceId };

/** A store a source can quote against. */
export interface SourceStore {
  /** The source's own id for the location, passed back on every quote. */
  locationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  distanceMi?: number;
  lat?: number;
  lng?: number;
}

export interface PriceSource {
  id: PriceSourceId;
  label: string;
  /** False until its credentials and server route exist. */
  configured: () => Promise<boolean>;
  /** Stores this source can quote against, near a zip code. */
  findStores: (zip: string, signal?: AbortSignal) => Promise<SourceStore[]>;
  /** Current prices for these foods at one of its locations. */
  quote: (
    foods: Food[],
    locationId: string,
    zip: string,
    signal?: AbortSignal,
  ) => Promise<PriceQuote[]>;
}

/** An unavailable quote, so a missing price is data rather than an exception. */
export function unavailable(
  food: Food,
  storeId: string,
  zip: string,
  source: PriceSourceId,
  note: string,
): PriceQuote {
  return {
    foodId: food.id,
    ingredient: normalizeIngredient(food.name),
    pricePerUnit: null,
    unit: food.unit,
    storeId,
    zip,
    lastRefreshed: today(),
    source,
    available: false,
    note,
  };
}

/**
 * The ingredient name a price is filed under: lower case, no brand, no
 * packaging, no punctuation. "Belgioioso Ciliegine Mozzarella" and "Mozzarella
 * Balls, 8oz" have to land on the same row or the cache never hits.
 */
export function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(oz|lb|lbs|g|kg|ml|l|ct|pk|fl)\b/g, " ")
    .replace(/\b(organic|fresh|large|small|whole|low fat|nonfat|original|classic)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Whole days between two ISO dates. */
export function daysSince(iso: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86_400_000);
}
