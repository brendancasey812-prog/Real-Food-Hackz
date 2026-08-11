"use client";

import { X } from "lucide-react";

type Row = [string, string];

const VOLUME: Row[] = [
  ["3 teaspoons", "1 tablespoon"],
  ["4 tablespoons", "¼ cup"],
  ["16 tablespoons", "1 cup"],
  ["8 fluid ounces", "1 cup"],
  ["2 cups", "1 pint"],
  ["2 pints", "1 quart"],
  ["4 quarts", "1 gallon"],
];
const WEIGHT: Row[] = [
  ["16 ounces", "1 pound"],
  ["8 ounces", "½ pound"],
  ["4 ounces", "¼ pound"],
];
const COUNT: Row[] = [
  ["12 each", "1 dozen"],
  ["6 each", "½ dozen"],
];
const HANDY: Row[] = [
  ["1 stick butter", "8 tbsp · ½ cup"],
  ["1 cup dry rice", "≈ 3 cups cooked"],
  ["1 large egg", "≈ 3 tbsp"],
  ["1 lb ground meat", "≈ 2 cups"],
];

function Table({ title, emoji, rows, wide }: { title: string; emoji: string; rows: Row[]; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <span>{emoji}</span> {title}
      </h3>
      <div>
        {rows.map(([a, b], i) => (
          <div key={a + b} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 text-sm ${i < rows.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
            <span className="text-right font-medium text-zinc-100">{a}</span>
            <span className="text-emerald-400">=</span>
            <span className="text-left text-zinc-300">{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <h2 className="text-lg font-semibold">📐 Conversions chart</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Table title="Volume" emoji="🥤" rows={VOLUME} wide />
            <Table title="Weight" emoji="⚖️" rows={WEIGHT} />
            <Table title="Count" emoji="🔢" rows={COUNT} />
            <Table title="Handy equivalents" emoji="🧑‍🍳" rows={HANDY} wide />
          </div>
          <p className="mt-4 text-[11px] leading-4 text-zinc-500">
            Volume-to-weight equivalents (like cups to ounces) depend on the ingredient, so the “handy” rows are approximate.
          </p>
        </div>
      </div>
    </div>
  );
}
