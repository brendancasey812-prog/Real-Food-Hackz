"use client";

import { X } from "lucide-react";

const GROUPS: { title: string; emoji: string; rows: [string, string][] }[] = [
  {
    title: "Weight",
    emoji: "⚖️",
    rows: [
      ["1 lb", "16 oz"],
      ["½ lb", "8 oz"],
      ["¼ lb", "4 oz"],
      ["1 oz", "0.0625 lb"],
    ],
  },
  {
    title: "Volume",
    emoji: "🥤",
    rows: [
      ["1 cup", "16 tbsp · 48 tsp"],
      ["1 cup", "8 fl oz"],
      ["½ cup", "8 tbsp"],
      ["1 tbsp", "3 tsp"],
      ["1 quart", "4 cups"],
      ["1 gallon", "16 cups"],
    ],
  },
  {
    title: "Count",
    emoji: "🔢",
    rows: [
      ["1 dozen", "12 each"],
      ["½ dozen", "6 each"],
      ["1 head garlic", "≈ 10 cloves"],
    ],
  },
  {
    title: "Handy kitchen equivalents",
    emoji: "🧑‍🍳",
    rows: [
      ["1 stick butter", "8 tbsp · ½ cup"],
      ["1 cup rice (dry)", "≈ 3 cups cooked"],
      ["1 large egg", "≈ 3 tbsp"],
      ["1 lb ground meat", "≈ 2 cups"],
    ],
  },
];

export function ConversionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="font-semibold">📐 Conversions chart</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {GROUPS.map((g) => (
            <div key={g.title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <span>{g.emoji}</span> {g.title}
              </h3>
              <div className="divide-y divide-white/[0.05]">
                {g.rows.map(([a, b]) => (
                  <div key={`${a}=${b}`} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-zinc-300">{a}</span>
                    <span className="text-zinc-400">= {b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-4 text-zinc-500">
            Cup ↔ weight varies by ingredient (a cup of flour and a cup of water weigh differently), so volume-to-weight rows are approximate.
          </p>
        </div>
      </div>
    </div>
  );
}
