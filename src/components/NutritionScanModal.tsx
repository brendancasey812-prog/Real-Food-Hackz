"use client";

import { useMemo, useRef, useState } from "react";
import {
  X, Camera, Upload, Loader2, Sparkles, KeyRound, AlertCircle, Check, Search,
} from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { ReceiptError } from "@/lib/receipt";
import {
  scanNutritionLabel, demoNutritionScan, servingInUnits, perUnitFrom,
  type ScannedNutrition,
} from "@/lib/nutritionscan";
import { UNITS, unitLabel, fmtQty } from "@/lib/units";
import { FOOD_CATEGORIES } from "@/lib/foodcat";
import type { Food, FoodCategory, Location, Unit } from "@/lib/types";

type Step = "upload" | "loading" | "review" | "done" | "error";
const KEY_STORE = "anthropic_api_key";
const OK_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/**
 * Photograph a Nutrition Facts panel and put its macros on a food.
 *
 * The label is per serving; the app stores everything per unit, so the middle
 * of this flow is one number — how many of the food's units a serving is. We
 * work it out from the label when the units can be bridged, and ask when they
 * can't, rather than quietly writing per-serving numbers into a per-unit field.
 */
export function NutritionScanModal({ onClose }: { onClose: () => void }) {
  const { foods, updateFood, addFood } = useApp();

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [scan, setScan] = useState<ScannedNutrition | null>(null);
  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(KEY_STORE) ?? "" : "",
  );
  const [showKey, setShowKey] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Where the numbers land: an existing food, or a new one.
  const [targetId, setTargetId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<Unit>("each");
  const [newCategory, setNewCategory] = useState<FoodCategory>("protein");
  const [newLocation, setNewLocation] = useState<Location>("fridge");
  const [perServing, setPerServing] = useState(1);
  const [autoBasis, setAutoBasis] = useState(true);
  const [savedName, setSavedName] = useState("");

  const target = foods.find((f) => f.id === targetId) ?? null;
  const unit: Unit = target ? target.unit : newUnit;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [foods, query]);

  const saveKey = (k: string) => {
    setApiKey(k);
    if (typeof window !== "undefined") localStorage.setItem(KEY_STORE, k.trim());
  };

  /** Once a label is read, guess the target food and the serving basis. */
  const settle = (s: ScannedNutrition, forUnit: Unit, id: string) => {
    const auto = servingInUnits(s.servingSize, s.servingUnit, forUnit);
    setAutoBasis(auto != null);
    setPerServing(auto ?? 1);
    setTargetId(id);
  };

  const run = async (p: Promise<ScannedNutrition>) => {
    setStep("loading");
    try {
      const s = await p;
      setScan(s);
      // A label that names its product usually matches something already stocked.
      const guess = s.foodName
        ? foods.find((f) => f.name.toLowerCase() === s.foodName.toLowerCase()) ??
          foods.find((f) => s.foodName.toLowerCase().includes(f.name.toLowerCase()))
        : undefined;
      setNewName(s.foodName);
      settle(s, guess?.unit ?? "each", guess?.id ?? "");
      setStep("review");
    } catch (e) {
      setError(e instanceof ReceiptError ? e.message : "Something went wrong reading that label. Please try again.");
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
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] ?? "";
      run(scanNutritionLabel(apiKey.trim(), base64, file.type as (typeof OK_TYPES)[number]));
    };
    reader.onerror = () => { setError("Couldn't read that file. Try another photo."); setStep("error"); };
    reader.readAsDataURL(file);
  };

  // Retarget: switching food changes the unit, so the basis is recomputed.
  const pickFood = (f: Food) => {
    if (!scan) return;
    setQuery("");
    settle(scan, f.unit, f.id);
  };
  const pickNew = () => {
    if (!scan) return;
    settle(scan, newUnit, "");
  };
  const changeNewUnit = (u: Unit) => {
    setNewUnit(u);
    if (scan) {
      const auto = servingInUnits(scan.servingSize, scan.servingUnit, u);
      setAutoBasis(auto != null);
      setPerServing(auto ?? 1);
    }
  };

  const perUnit = scan && perServing > 0 ? perUnitFrom(scan, perServing) : null;
  const canSave = Boolean(scan && perUnit && perServing > 0 && (target || newName.trim()));

  const save = () => {
    if (!scan || !perUnit || !canSave) return;
    if (target) {
      updateFood(target.id, {
        caloriesPerUnit: perUnit.caloriesPerUnit,
        protein: perUnit.protein,
        carbs: perUnit.carbs,
        fat: perUnit.fat,
        // A label the user scanned outranks the USDA reference from now on.
        nutritionSource: "scan",
      });
      setSavedName(target.name);
    } else {
      const food: Food = {
        id: newId(),
        name: newName.trim(),
        unit: newUnit,
        caloriesPerUnit: perUnit.caloriesPerUnit,
        protein: perUnit.protein,
        carbs: perUnit.carbs,
        fat: perUnit.fat,
        location: newLocation,
        category: newCategory,
        emoji: "🥫",
        source: "manual",
        nutritionSource: "scan",
      };
      addFood(food, 0);
      setSavedName(food.name);
    }
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles size={18} className="text-accent-soft" /> Scan nutrition label
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-muted">
                Photograph the Nutrition Facts panel on a package. Claude reads the serving size,
                calories and macros, and writes them onto a food in your tracker — you check the
                numbers before anything is saved.
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
                  <Upload size={26} className="text-accent-soft" /> Upload an image
                  <span className="text-xs font-normal text-muted">JPG, PNG, or WebP</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

              <button
                onClick={() => run(demoNutritionScan())}
                className="w-full rounded-xl border border-dashed border-line-2 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3"
              >
                Try a sample label (no key needed)
              </button>

              <div className="rounded-xl border border-line bg-surface p-4">
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="flex w-full items-center gap-2 text-left text-sm font-medium"
                >
                  <KeyRound size={15} className="text-muted" />
                  Anthropic API key{" "}
                  {apiKey
                    ? <span className="text-xs text-accent-soft">· set</span>
                    : <span className="text-xs text-muted">· not set</span>}
                </button>
                {showKey && (
                  <>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => saveKey(e.target.value)}
                      placeholder="sk-ant-…"
                      className="field mt-3 w-full rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="mt-2 text-[11px] leading-4 text-muted">
                      Stored only in this browser and sent straight to Anthropic. The sample above
                      needs no key.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted">
              <Loader2 size={30} className="animate-spin text-accent-soft" />
              Reading the label…
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle size={34} className="text-danger-soft" />
              <p className="max-w-sm text-sm text-ink-2">{error}</p>
              <button onClick={() => { setError(""); setStep("upload"); }} className="btn-accent mt-2 rounded-xl px-5 py-2.5 text-sm">
                Try again
              </button>
            </div>
          )}

          {step === "review" && scan && (
            <div className="space-y-5">
              {/* What the label said */}
              <div>
                <Label>On the label</Label>
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{scan.foodName || "Nutrition Facts"}</p>
                    <p className="text-xs text-muted">
                      Serving: {fmtQty(scan.servingSize)} {scan.servingUnit || "serving"}
                      {scan.servingsPerContainer ? ` · ${fmtQty(scan.servingsPerContainer)} per container` : ""}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Num label="cal" value={scan.calories} onChange={(v) => setScan({ ...scan, calories: v })} tone="text-cal-soft" />
                    <Num label="protein g" value={scan.protein} onChange={(v) => setScan({ ...scan, protein: v })} tone="text-protein-soft" />
                    <Num label="carbs g" value={scan.carbs} onChange={(v) => setScan({ ...scan, carbs: v })} tone="text-carbs-soft" />
                    <Num label="fat g" value={scan.fat} onChange={(v) => setScan({ ...scan, fat: v })} tone="text-fat-soft" />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">Per serving. Correct anything the scan misread.</p>
                </div>
              </div>

              {/* Which food it belongs to */}
              <div>
                <Label>Apply to</Label>
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={target ? target.name : query}
                    onChange={(e) => { setTargetId(""); setQuery(e.target.value); }}
                    placeholder="Search your foods…"
                    className="field w-full rounded-xl py-2 pl-9 pr-8 text-sm"
                  />
                  {target && (
                    <button
                      onClick={() => { setTargetId(""); setQuery(""); }}
                      aria-label="Clear selection"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {!target && (
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-line bg-surface">
                    {matches.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => pickFood(f)}
                        className="flex w-full items-center gap-2.5 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-accent-wash"
                      >
                        <span>{f.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                        <span className="shrink-0 text-[11px] text-muted">
                          {f.caloriesPerUnit} cal / {unitLabel(f.unit)}
                        </span>
                      </button>
                    ))}
                    {matches.length === 0 && (
                      <p className="px-3 py-3 text-sm text-muted">No food matches “{query}”.</p>
                    )}
                  </div>
                )}

                {!target && (
                  <div className="mt-2 rounded-xl border border-dashed border-line-2 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Or add it as a new food
                    </p>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={pickNew}
                      placeholder="Food name"
                      className="field w-full rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <select value={newUnit} onChange={(e) => changeNewUnit(e.target.value as Unit)} className="field rounded-lg px-2 py-2 text-sm">
                        {UNITS.map((u) => <option key={u.value} value={u.value}>per {u.label}</option>)}
                      </select>
                      <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as FoodCategory)} className="field rounded-lg px-2 py-2 text-sm">
                        {FOOD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <select value={newLocation} onChange={(e) => setNewLocation(e.target.value as Location)} className="field rounded-lg px-2 py-2 text-sm">
                        <option value="fridge">Fridge</option>
                        <option value="freezer">Freezer</option>
                        <option value="pantry">Pantry</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* The one number that turns per-serving into per-unit */}
              <div>
                <Label>Serving size in {unitLabel(unit)}</Label>
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-2">One serving =</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={perServing}
                      onChange={(e) => { setPerServing(Number(e.target.value) || 0); setAutoBasis(false); }}
                      className="field w-24 rounded-lg px-2 py-1.5 text-right text-sm tabular-nums"
                    />
                    <span className="text-ink-2">{unitLabel(unit)}</span>
                  </div>
                  <p className={`mt-2 text-[11px] leading-4 ${autoBasis ? "text-muted" : "text-warn-soft"}`}>
                    {autoBasis
                      ? `Worked out from the label’s “${fmtQty(scan.servingSize)} ${scan.servingUnit}”.`
                      : `The label’s “${scan.servingUnit || "serving"}” can’t be converted to ${unitLabel(unit)} automatically — check this number.`}
                  </p>
                </div>
              </div>

              {/* What actually gets written */}
              {perUnit && (
                <div>
                  <Label>Saved as, per {unitLabel(unit)}</Label>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Tile value={perUnit.caloriesPerUnit} label="cal" bg="bg-cal/12" text="text-cal-soft" />
                    <Tile value={`${perUnit.protein}g`} label="protein" bg="bg-protein/12" text="text-protein-soft" />
                    <Tile value={`${perUnit.carbs}g`} label="carbs" bg="bg-carbs/12" text="text-carbs-soft" />
                    <Tile value={`${perUnit.fat}g`} label="fat" bg="bg-fat/12" text="text-fat-soft" />
                  </div>
                  {target && (
                    <p className="mt-2 text-[11px] text-muted">
                      Replaces {target.name}&apos;s current {target.caloriesPerUnit} cal / {unitLabel(target.unit)}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft">
                <Check size={28} />
              </span>
              <p className="font-semibold text-ink">Macros saved</p>
              <p className="max-w-sm text-sm text-muted">
                {savedName} now carries these numbers everywhere — recipes, the meal plan and the
                dashboard all recalculate from them.
              </p>
            </div>
          )}
        </div>

        {(step === "review" || step === "done") && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-4">
            {step === "review" ? (
              <>
                <button onClick={() => setStep("upload")} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-ink">
                  Start over
                </button>
                <button
                  onClick={save}
                  disabled={!canSave}
                  className="btn-accent flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check size={16} /> Save macros
                </button>
              </>
            ) : (
              <button onClick={onClose} className="btn-accent ml-auto rounded-xl px-5 py-2.5 text-sm">Done</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

function Num({
  label, value, onChange, tone,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone: string;
}) {
  return (
    <label className="block">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        aria-label={label}
        className={`field w-full rounded-lg px-2 py-1.5 text-center text-sm font-semibold tabular-nums ${tone}`}
      />
      <span className="mt-1 block text-center text-[10px] text-muted">{label}</span>
    </label>
  );
}

function Tile({
  value, label, bg, text,
}: {
  value: number | string;
  label: string;
  bg: string;
  text: string;
}) {
  return (
    <div className={`rounded-xl py-2.5 ${bg}`}>
      <div className={`text-base font-semibold tabular-nums ${text}`}>{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
