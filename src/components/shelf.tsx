"use client";

import { Check, ChevronDown } from "lucide-react";
import type { FoodCategory } from "@/lib/types";

/**
 * The shelf-and-tile language shared by the Food Tracker, the Grocery list and
 * the Costs repository: a steel cabinet holding glass shelves, each opening
 * onto a grid of tiles.
 *
 * A tile leads with the number the tab is about — how much you have, how much
 * to buy, what it costs — because that is what you are scanning for. The three
 * tabs differ only in which number that is.
 */

/** Tiles are tinted with the palette colour of the food group they belong to. */
export const CATEGORY_TINT: Record<FoodCategory, string> = {
  protein: "from-protein/30 to-protein/10 ring-protein/25",
  dairy: "from-sea/30 to-sea/10 ring-sea/25",
  grain: "from-carbs/30 to-carbs/10 ring-carbs/25",
  starch: "from-carbs/25 to-carbs/8 ring-carbs/20",
  legume: "from-fat/30 to-fat/10 ring-fat/25",
  nut: "from-fat/25 to-fat/8 ring-fat/20",
  fat: "from-fat/30 to-fat/10 ring-fat/25",
  vegetable: "from-accent/30 to-accent/10 ring-accent/25",
  fruit: "from-over/30 to-over/10 ring-over/25",
  condiment: "from-warn/30 to-warn/10 ring-warn/25",
  spice: "from-sea/25 to-accent/8 ring-sea/20"
};

/** The brushed-steel cabinet everything sits inside. */
export function Appliance({ children }: { children: React.ReactNode }) {
  return (
    <div className="appliance relative rounded-[28px] p-3 md:p-4">
      <span
        aria-hidden
        className="handle absolute right-2.5 top-10 bottom-10 hidden w-2 rounded-full md:block"
      />
      <div className="space-y-2.5 md:pr-8">{children}</div>
    </div>
  );
}

/** A glass shelf (or crisper drawer) that opens to reveal its contents. */
export function Shelf({
  title, subtitle, open, onToggle, right, drawer = false, children
}: {
  title: string;
  subtitle?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Extra detail on the right of the header, before the chevron. */
  right?: React.ReactNode;
  drawer?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`glass overflow-hidden rounded-2xl ${open ? "glass-open" : ""}`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          {subtitle && <span className="block text-[11px] text-muted">{subtitle}</span>}
        </span>
        {right}
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="shelf-open border-t border-glass-line px-3 pb-4 pt-3">{children}</div>
      )}

      {drawer && <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line-2" />}
    </div>
  );
}

/** The grid tiles are laid out on. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {children}
    </div>
  );
}

export type TileTone = "accent" | "muted" | "warn" | "danger";

const TONE_TEXT: Record<TileTone, string> = {
  accent: "text-ink",
  muted: "text-faint",
  warn: "text-warn-soft",
  danger: "text-danger-soft"
};

/**
 * One food, drawn as a tile: its number on the face, what it is underneath.
 *
 * The face is a button and the corner mark is a separate one, so a tab can
 * offer a one-tap action (ticking a grocery off) without giving up the tap
 * that opens the food itself.
 */
export function AppTile({
  name, value, unit, sub, tone = "accent", tint, selected = false,
  dimmed = false, strike = false, disabled = false, onClick, ariaLabel, corner
}: {
  name: string;
  /** The headline number: how much you have, how much to buy, what it costs. */
  value: React.ReactNode;
  /** The small line under it — the unit that number is in. */
  unit?: React.ReactNode;
  /** The line under the name — calories, price, whatever the tab is about. */
  sub?: React.ReactNode;
  tone?: TileTone;
  tint: string;
  selected?: boolean;
  /** Faded — out of stock, unpriced, not yet filled in. */
  dimmed?: boolean;
  /** Struck through — done with, as in a grocery already picked up. */
  strike?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  /** An action pinned to the tile's corner, e.g. tick this off the list. */
  corner?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={selected || undefined}
        className={`app-tile flex h-full flex-col items-center gap-1.5 text-center ${
          disabled ? "cursor-not-allowed opacity-40" : ""
        }`}
      >
        <span
          className={`squircle relative flex h-16 w-16 flex-col items-center justify-center bg-gradient-to-br ring-1 ${tint} ${
            selected ? "ring-2 ring-accent" : ""
          } ${dimmed ? "opacity-50" : ""}`}
        >
          <span className={`text-lg font-semibold leading-none tabular-nums ${TONE_TEXT[tone]}`}>
            {value}
          </span>
          {unit != null && (
            <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted">{unit}</span>
          )}
        </span>

        <span
          className={`line-clamp-2 flex-1 text-[11px] font-medium leading-tight ${
            strike ? "text-muted line-through" : dimmed ? "text-muted" : "text-ink"
          }`}
        >
          {name}
        </span>
        {sub != null && <span className="text-[10px] tabular-nums text-muted">{sub}</span>}
      </button>

      {corner && <div className="absolute -right-1 -top-1">{corner}</div>}
    </div>
  );
}

/** A small round tick pinned to a tile's corner. */
export function TileTick({
  on, label, onClick
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
        on ? "border-accent bg-accent text-on-accent" : "border-line-2 bg-page hover:border-accent"
      }`}
    >
      {on && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

/** The view switch each of these tabs carries. */
export function ViewToggle<T extends string>({
  value, onChange, options
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <div className="mb-4 flex w-fit rounded-xl border border-line bg-surface p-0.5 text-sm">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${
            value === k
              ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
              : "text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
