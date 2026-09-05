"use client";

import { useState } from "react";
import { Plus, ScanLine, Menu, Calculator, Sparkles, BookMarked, ClipboardList } from "lucide-react";
import { AddFoodModal } from "@/components/AddFoodModal";
import { ScanReceiptModal } from "@/components/ScanReceiptModal";
import { ReceiptTextModal } from "@/components/ReceiptTextModal";
import { ConversionsModal } from "@/components/ConversionsModal";
import { NutritionScanModal } from "@/components/NutritionScanModal";
import { UsdaFillModal } from "@/components/UsdaFillModal";
import type { Location } from "@/lib/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Fridge } from "@/components/Fridge";

export default function Kitchen() {
  const [adding, setAdding] = useState<Location | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [usdaOpen, setUsdaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { label: "Add food", icon: Plus, run: () => setAdding("fridge") },
    { label: "Paste a receipt", icon: ClipboardList, run: () => setPasting(true) },
    { label: "Scan receipt (photo)", icon: ScanLine, run: () => setScanning(true) },
    { label: "Scan nutrition label", icon: Sparkles, run: () => setLabelOpen(true) },
    { label: "Fill macros from USDA", icon: BookMarked, run: () => setUsdaOpen(true) },
    { label: "Conversions chart", icon: Calculator, run: () => setConvOpen(true) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Food Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            Open a shelf to see what&apos;s in it · tap a food to set how much you have,
            price it, move it or edit it.
          </p>
        </div>
        {/* Hamburger menu + settings (top-right) */}
        <div className="flex shrink-0 items-start gap-2">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep px-4 text-sm font-medium text-on-accent shadow-lg hover:brightness-110"
          >
            <Menu size={18} /> Menu
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-page p-1 shadow-2xl">
                {menuItems.map((it) => (
                  <button key={it.label} onClick={() => { it.run(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                    <it.icon size={16} className="text-accent-soft" /> {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <SettingsButton className="hidden md:flex" />
        </div>
      </header>

      <Fridge />

      {adding && <AddFoodModal context="kitchen" defaultLocation={adding} onClose={() => setAdding(null)} />}
      {scanning && <ScanReceiptModal onClose={() => setScanning(false)} />}
      {pasting && <ReceiptTextModal onClose={() => setPasting(false)} />}
      {convOpen && <ConversionsModal onClose={() => setConvOpen(false)} />}
      {labelOpen && <NutritionScanModal onClose={() => setLabelOpen(false)} />}
      {usdaOpen && <UsdaFillModal onClose={() => setUsdaOpen(false)} />}
    </div>
  );
}
