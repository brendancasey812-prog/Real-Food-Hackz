"use client";

import { ChevronDown } from "lucide-react";
import type { FoodCategory } from "@/lib/types";

/**
 * The shelf-and-tile language the Food Tracker introduced, shared so the
 * Groceries and Costs tabs read the same way: a steel cabinet holding glass
 * shelves, each opening onto a grid of app icons.
 */

/** Icons are tinted with the palette colour of the food group they belong to. */
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
  emoji, title, subtitle, open, onToggle, right, drawer = false, children,
}: {
  emoji: string;
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
        <span className="text-xl">{emoji}</span>
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

/** The grid app icons are laid out on. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {children}
    </div>
  );
}

export type BadgeTone = "accent" | "muted" | "warn" | "cal" | "danger" | "outline";

const BADGE_TONE: Record<BadgeTone, string> = {
  accent: "bg-accent text-on-accent",
  muted: "bg-surface-3 text-muted",
  warn: "bg-warn text-on-accent",
  cal: "bg-cal text-on-accent",
  danger: "bg-danger text-on-accent",
  outline: "border border-line-2 bg-page text-transparent",
};

/**
 * One item, drawn like an app icon: the food on top, what it is underneath,
 * and its number badged on the corner.
 */
export function AppTile({
  emoji, name, sub, badge, badgeTone = "accent", tint, selected = false,
  dimmed = false, strike = false, disabled = false, onClick, ariaLabel,
}: {
  emoji: string;
  name: string;
  /** The line under the name — quantity, price, whatever the tab is about. */
  sub?: React.ReactNode;
  badge?: React.ReactNode;
  badgeTone?: BadgeTone;
  tint: string;
  selected?: boolean;
  /** Faded — out of stock, unpriced, not yet filled in. */
  dimmed?: boolean;
  /** Struck through — done with, as in a grocery item already picked up.
   *  Deliberately separate from `dimmed`: an empty food is faint, not finished. */
  strike?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
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
        className={`squircle relative flex h-16 w-16 items-center justify-center bg-gradient-to-br text-[28px] ring-1 ${tint} ${
          selected ? "ring-2 ring-accent" : ""
        } ${dimmed ? "opacity-50" : ""}`}
      >
        <span aria-hidden>{emoji}</span>
        {badge != null && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${BADGE_TONE[badgeTone]}`}
          >
            {badge}
          </span>
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
  );
}

/** The Fridge / List style switch each of these tabs carries. */
export function ViewToggle<T extends string>({
  value, onChange, options,
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
