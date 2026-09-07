"use client";

import { useState } from "react";
import { Plus, ScanLine, Menu, Calculator, Sparkles, BookMarked, ClipboardList } from "lucide-react";
import { AddFoodModal } from "./AddFoodModal";
import { ScanReceiptModal } from "./ScanReceiptModal";
import { ReceiptTextModal } from "./ReceiptTextModal";
import { ConversionsModal } from "./ConversionsModal";
import { NutritionScanModal } from "./NutritionScanModal";
import { UsdaFillModal } from "./UsdaFillModal";
import type { Location } from "@/lib/types";

/**
 * The same menu on every tab that shows your foods.
 *
 * Adding a food, filing a receipt, reading a label — none of that belongs to
 * one tab more than another, so the Food Tracker, the Grocery list and the Cost
 * repository all carry this identical button. Only `context` differs: adding a
 * food on the grocery list means adding something to buy, and on the other tabs
 * it means something you already have.
 */
export function KitchenMenu({ context }: { context: "kitchen" | "grocery" }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<Location | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [usdaOpen, setUsdaOpen] = useState(false);

  const items = [
    { label: context === "grocery" ? "Add item to buy" : "Add food", icon: Plus, run: () => setAdding("fridge") },
    { label: "Paste a receipt", icon: ClipboardList, run: () => setPasting(true) },
    { label: "Scan receipt (photo)", icon: ScanLine, run: () => setScanning(true) },
    { label: "Scan nutrition label", icon: Sparkles, run: () => setLabelOpen(true) },
    { label: "Fill macros from USDA", icon: BookMarked, run: () => setUsdaOpen(true) },
    { label: "Conversions chart", icon: Calculator, run: () => setConvOpen(true) },
  ];

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep px-4 text-sm font-medium text-on-accent shadow-lg hover:brightness-110 md:h-11"
        >
          <Menu size={18} /> Menu
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-page p-1 shadow-2xl">
              {items.map((it) => (
                <button
                  key={it.label}
                  onClick={() => { it.run(); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash"
                >
                  <it.icon size={16} className="text-accent-soft" /> {it.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {adding && (
        <AddFoodModal
          context={context}
          defaultLocation={adding}
          onClose={() => setAdding(null)}
        />
      )}
      {scanning && <ScanReceiptModal onClose={() => setScanning(false)} />}
      {pasting && <ReceiptTextModal onClose={() => setPasting(false)} />}
      {convOpen && <ConversionsModal onClose={() => setConvOpen(false)} />}
      {labelOpen && <NutritionScanModal onClose={() => setLabelOpen(false)} />}
      {usdaOpen && <UsdaFillModal onClose={() => setUsdaOpen(false)} />}
    </>
  );
}
