"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Refrigerator,
  DollarSign,
  MapPin,
} from "lucide-react";
import { Logo } from "./Logo";
import { SettingsButton } from "./SettingsButton";

/** True only after client hydration — avoids SSR/persisted-store mismatch. */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** `short` is what the phone tab bar uses, where seven labels have to fit. */
const nav = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/recipes", label: "Cookbook", short: "Cookbook", icon: BookOpen },
  { href: "/planner", label: "Meal Plan", short: "Plan", icon: CalendarDays },
  { href: "/groceries", label: "Groceries", short: "Grocery", icon: ShoppingCart },
  { href: "/kitchen", label: "Food Tracker", short: "Food", icon: Refrigerator },
  { href: "/costs", label: "Costs", short: "Costs", icon: DollarSign },
  { href: "/stores", label: "Stores", short: "Stores", icon: MapPin },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();

  return (
    <div className="flex min-h-full text-ink">
      {/* Desktop sidebar (website format) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 backdrop-blur-xl md:flex">
        <div className="mb-8 px-1.5">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-accent-wash to-transparent text-accent-soft"
                    : "text-muted hover:bg-surface-3 hover:text-ink"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-accent" />
                )}
                <Icon size={18} className={active ? "text-accent-soft" : "text-muted group-hover:text-ink-2"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-line bg-surface p-3 text-xs text-muted">
          <span className="font-medium text-ink-2">Balanced by design</span>
          <p className="mt-1 leading-5">Calories &amp; macros stay in sync across every tab.</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (app format) */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bar px-4 py-3 backdrop-blur-xl md:hidden">
          <Logo small />
          <SettingsButton />
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          {hydrated ? (
            children
          ) : (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Loading your kitchen…
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar (app format) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bar px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {nav.map(({ href, short, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-accent-soft" : "text-muted"
              }`}
            >
              <span className={`flex h-6 w-10 items-center justify-center rounded-full transition-all ${active ? "bg-accent-wash" : ""}`}>
                <Icon size={17} />
              </span>
              <span className="w-full truncate px-0.5 text-center">{short}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
