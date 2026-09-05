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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles size={18} className="text-accent-soft" /> Scan receipt
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-muted">
                Take a photo of a grocery receipt (or upload one). Claude reads it, sorts the items, and adds them to your kitchen — you review everything before it&apos;s saved.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-8 text-sm font-medium hover:border-accent hover:bg-accent-wash"
                >
                  <Camera size={26} className="text-accent-soft" /> Take a photo
                  <span className="text-xs font-normal text-muted">Uses your phone camera</span>
                </button>
                <button
                  onClick={() => { fileRef.current?.removeAttribute("capture"); fileRef.current?.click(); }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-8 text-sm font-medium hover:border-accent hover:bg-accent-wash"
                >
                  <Upload size={26} className="text-accent-soft" /> Upload a photo
                  <span className="text-xs font-normal text-muted">JPG, PNG, or WebP</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

              <button
                onClick={() => runScan(demoScan())}
                className="w-full rounded-xl border border-dashed border-line-2 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3"
              >
                Try a sample receipt (no key needed)
              </button>

              {/* API key settings */}
              <div className="rounded-xl border border-line bg-surface p-3">
                <button onClick={() => setShowKey((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium text-ink-2">
                  <KeyRound size={15} className="text-muted" />
                  Anthropic API key {apiKey ? <span className="text-xs text-accent-soft">· set</span> : <span className="text-xs text-muted">· not set</span>}
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
                    <p className="text-[11px] leading-4 text-muted">
                      Stored only in this browser and sent straight to Anthropic. Get one at console.anthropic.com. Real scanning uses the API (paid per use).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted">
              <Loader2 size={30} className="animate-spin text-accent-soft" />
              Reading your receipt…
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle size={34} className="text-danger-soft" />
              <p className="max-w-sm text-sm text-ink-2">{error}</p>
              <button onClick={() => setStep("upload")} className="rounded-xl bg-gradient-to-b from-accent to-accent-deep px-5 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
                Try again
              </button>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Found <span className="font-medium text-ink">{items.length}</span> item{items.length === 1 ? "" : "s"}. Fix anything, delete non-food rows, then add to your kitchen.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
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
                      <tr key={i} className="border-t border-line">
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
                            {it.estimated && <span title="Estimated size" className="rounded bg-warn/12 px-1 text-[10px] font-medium text-warn-soft">est</span>}
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 text-muted">{it.unit}</td>
                        <td className="py-1.5">
                          <button onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))} className="text-muted hover:text-danger-soft" aria-label="Delete row">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {excluded.length > 0 && (
                <div className="rounded-xl border border-line bg-surface p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Excluded (non-food)</div>
                  <ul className="space-y-0.5 text-xs text-muted">
                    {excluded.map((e, i) => (
                      <li key={i}>{e.raw_text} — <span className="text-muted">{e.reason}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep("upload")} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">Back</button>
                <button onClick={confirm} disabled={items.length === 0} className="flex-1 rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110 disabled:opacity-40">
                  Add {items.length} to kitchen
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft"><Check size={30} /></span>
              <div>
                <p className="font-semibold">Added to your kitchen</p>
                <p className="mt-1 text-sm text-muted">
                  {summary.merged} restocked · {summary.added} new item{summary.added === 1 ? "" : "s"}
                  {summary.skipped > 0 && ` · ${summary.skipped} logged (unit mismatch)`}
                </p>
              </div>
              <button onClick={onClose} className="rounded-xl bg-gradient-to-b from-accent to-accent-deep px-6 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
