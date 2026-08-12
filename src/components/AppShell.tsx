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
  Salad,
} from "lucide-react";

/** True only after client hydration — avoids SSR/persisted-store mismatch. */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recipes", label: "Cookbook", icon: BookOpen },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/groceries", label: "Groceries", icon: ShoppingCart },
  { href: "/kitchen", label: "Kitchen", icon: Refrigerator },
];

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-950/50"
        style={{ height: small ? 30 : 36, width: small ? 30 : 36 }}
      >
        <Salad size={small ? 17 : 20} />
      </span>
      <span className={`font-semibold tracking-tight ${small ? "text-base" : "text-lg"}`}>
        Real Food Hackz
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();

  return (
    <div className="flex min-h-full text-zinc-100">
      {/* Desktop sidebar (website format) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.02] px-4 py-6 backdrop-blur-xl md:flex">
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
                    ? "bg-gradient-to-r from-emerald-500/20 to-transparent text-emerald-300"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.6)]" />
                )}
                <Icon size={18} className={active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-500">
          <span className="font-medium text-zinc-300">Balanced by design</span>
          <p className="mt-1 leading-5">Calories &amp; macros stay in sync across every tab.</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (app format) */}
        <header className="sticky top-0 z-10 flex items-center border-b border-white/[0.06] bg-black/40 px-4 py-3 backdrop-blur-xl md:hidden">
          <Logo small />
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          {hydrated ? (
            children
          ) : (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Loading your kitchen…
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar (app format) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/[0.08] bg-black/60 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-all ${active ? "bg-emerald-500/15" : ""}`}>
                <Icon size={19} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
