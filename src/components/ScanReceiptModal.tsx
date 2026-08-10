"use client";

import { useRef, useState } from "react";
import { X, Camera, Upload, Loader2, Trash2, Sparkles, KeyRound, AlertCircle, Check } from "lucide-react";
import { useApp } from "@/lib/store";
import { scanReceipt, demoScan, ReceiptError } from "@/lib/receipt";
import type { ScannedItem, ScanResult } from "@/lib/types";

type Step = "upload" | "loading" | "review" | "done" | "error";
const CATS: ScannedItem["category"][] = ["Protein", "Fruit", "Veggie", "Pantry"];
const KEY_STORE = "anthropic_api_key";
const OK_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export function ScanReceiptModal({ onClose }: { onClose: () => void }) {
  const commitScan = useApp((s) => s.commitScan);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [excluded, setExcluded] = useState<ScanResult["excluded_items"]>([]);
  const [summary, setSummary] = useState({ merged: 0, added: 0, skipped: 0 });
  const [apiKey, setApiKey] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(KEY_STORE) ?? "" : ""));
  const [showKey, setShowKey] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const saveKey = (k: string) => {
    setApiKey(k);
    if (typeof window !== "undefined") localStorage.setItem(KEY_STORE, k.trim());
  };

  const runScan = async (result: Promise<ScanResult>) => {
    setStep("loading");
    try {
      const r = await result;
      setItems(r.items);
      setExcluded(r.excluded_items);
      setStep("review");
    } catch (e) {
      setError(e instanceof ReceiptError ? e.message : "Something went wrong reading the receipt. Please try again.");
      setStep("error");
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!OK_TYPES.includes(file.type as (typeof OK_TYPES)[number])) {
      setError("That image type isn't supported. Please use a JPG, PNG, or WebP photo.");
      setStep("error");
      return;
    }
    if (!apiKey.trim()) {
      setError("Add your Anthropic API key in Settings to scan a real photo — or tap “Try a sample” to see how it works.");
      setStep("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(",")[1] ?? "";
      runScan(scanReceipt(apiKey.trim(), base64, file.type as (typeof OK_TYPES)[number]));
    };
    reader.onerror = () => { setError("Couldn't read that file. Try another photo."); setStep("error"); };
    reader.readAsDataURL(file);
  };

  const updateItem = (i: number, patch: Partial<ScannedItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const confirm = () => {
    const clean = items.filter((i) => i.food.trim() && i.quantity > 0);
    setSummary(commitScan(clean));
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles size={18} className="text-emerald-400" /> Scan receipt
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-zinc-400">
                Take a photo of a grocery receipt (or upload one). Claude reads it, sorts the items, and adds them to your kitchen — you review everything before it&apos;s saved.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm font-medium hover:border-emerald-400/60 hover:bg-emerald-500/10"
                >
                  <Camera size={26} className="text-emerald-400" /> Take a photo
                  <span className="text-xs font-normal text-zinc-500">Uses your phone camera</span>
                </button>
                <button
                  onClick={() => { fileRef.current?.removeAttribute("capture"); fileRef.current?.click(); }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm font-medium hover:border-emerald-400/60 hover:bg-emerald-500/10"
                >
                  <Upload size={26} className="text-emerald-400" /> Upload a photo
                  <span className="text-xs font-normal text-zinc-500">JPG, PNG, or WebP</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

              <button
                onClick={() => runScan(demoScan())}
                className="w-full rounded-xl border border-dashed border-white/15 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.04]"
              >
                Try a sample receipt (no key needed)
              </button>

              {/* API key settings */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <button onClick={() => setShowKey((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium text-zinc-300">
                  <KeyRound size={15} className="text-zinc-400" />
                  Anthropic API key {apiKey ? <span className="text-xs text-emerald-400">· set</span> : <span className="text-xs text-zinc-500">· not set</span>}
                </button>
                {showKey && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => saveKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full rounded-lg field px-3 py-2 text-sm"
                    />
                    <p className="text-[11px] leading-4 text-zinc-500">
                      Stored only in this browser and sent straight to Anthropic. Get one at console.anthropic.com. Real scanning uses the API (paid per use).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-zinc-400">
              <Loader2 size={30} className="animate-spin text-emerald-400" />
              Reading your receipt…
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle size={34} className="text-rose-400" />
              <p className="max-w-sm text-sm text-zinc-300">{error}</p>
              <button onClick={() => setStep("upload")} className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">
                Try again
              </button>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Found <span className="font-medium text-zinc-200">{items.length}</span> item{items.length === 1 ? "" : "s"}. Fix anything, delete non-food rows, then add to your kitchen.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                      <th className="pb-2 pr-2 font-semibold">Category</th>
                      <th className="pb-2 pr-2 font-semibold">Food</th>
                      <th className="pb-2 pr-2 font-semibold">Variant</th>
                      <th className="pb-2 pr-2 font-semibold">Qty</th>
                      <th className="pb-2 pr-2 font-semibold">Unit</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-white/[0.06]">
                        <td className="py-1.5 pr-2">
                          <select value={it.category} onChange={(e) => updateItem(i, { category: e.target.value as ScannedItem["category"] })} className="rounded-lg field px-2 py-1.5 text-sm">
                            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={it.food} onChange={(e) => updateItem(i, { food: e.target.value })} className="w-32 rounded-lg field px-2 py-1.5 text-sm" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={it.variant} onChange={(e) => updateItem(i, { variant: e.target.value })} placeholder="—" className="w-24 rounded-lg field px-2 py-1.5 text-sm" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-1">
                            <input type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className="w-16 rounded-lg field px-2 py-1.5 text-sm" />
                            {it.estimated && <span title="Estimated size" className="rounded bg-amber-500/20 px-1 text-[10px] font-medium text-amber-300">est</span>}
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 text-zinc-400">{it.unit}</td>
                        <td className="py-1.5">
                          <button onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-rose-400" aria-label="Delete row">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {excluded.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Excluded (non-food)</div>
                  <ul className="space-y-0.5 text-xs text-zinc-400">
                    {excluded.map((e, i) => (
                      <li key={i}>{e.raw_text} — <span className="text-zinc-500">{e.reason}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep("upload")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.06]">Back</button>
                <button onClick={confirm} disabled={items.length === 0} className="flex-1 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110 disabled:opacity-40">
                  Add {items.length} to kitchen
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><Check size={30} /></span>
              <div>
                <p className="font-semibold">Added to your kitchen</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {summary.merged} restocked · {summary.added} new item{summary.added === 1 ? "" : "s"}
                  {summary.skipped > 0 && ` · ${summary.skipped} logged (unit mismatch)`}
                </p>
              </div>
              <button onClick={onClose} className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
