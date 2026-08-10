"use client";

import { useRef, useState } from "react";
import { X, Camera, Upload, Loader2, Trash2, Sparkles, KeyRound, AlertCircle, Check } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { scanRecipe, demoScanRecipe, type ScannedRecipe } from "@/lib/recipescan";
import { normalizeName, mapCategory, ReceiptError } from "@/lib/receipt";
import { UNITS } from "@/lib/units";
import { MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import type { Food, MealType, Unit } from "@/lib/types";

type Step = "upload" | "loading" | "review" | "done" | "error";
const KEY_STORE = "anthropic_api_key";
const OK_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const CATS = ["Protein", "Fruit", "Veggie", "Pantry"] as const;

export function RecipeScanModal({ onClose }: { onClose: () => void }) {
  const { foods, addRecipe } = useApp();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState<ScannedRecipe | null>(null);
  const [apiKey, setApiKey] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(KEY_STORE) ?? "" : ""));
  const [showKey, setShowKey] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const saveKey = (k: string) => { setApiKey(k); if (typeof window !== "undefined") localStorage.setItem(KEY_STORE, k.trim()); };

  const run = async (p: Promise<ScannedRecipe>) => {
    setStep("loading");
    try { setRecipe(await p); setStep("review"); }
    catch (e) { setError(e instanceof ReceiptError ? e.message : "Something went wrong reading the recipe."); setStep("error"); }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!OK_TYPES.includes(file.type as (typeof OK_TYPES)[number])) { setError("Use a JPG, PNG, or WebP photo."); setStep("error"); return; }
    if (!apiKey.trim()) { setError("Add your Anthropic API key in Settings to scan a photo — or tap “Try a sample”."); setStep("error"); return; }
    const reader = new FileReader();
    reader.onload = () => run(scanRecipe(apiKey.trim(), String(reader.result).split(",")[1] ?? "", file.type as (typeof OK_TYPES)[number]));
    reader.onerror = () => { setError("Couldn't read that file."); setStep("error"); };
    reader.readAsDataURL(file);
  };

  const patch = (p: Partial<ScannedRecipe>) => setRecipe((r) => (r ? { ...r, ...p } : r));
  const patchIng = (i: number, p: Partial<ScannedRecipe["ingredients"][number]>) =>
    setRecipe((r) => (r ? { ...r, ingredients: r.ingredients.map((it, idx) => (idx === i ? { ...it, ...p } : it)) } : r));

  const confirm = () => {
    if (!recipe) return;
    const newFoods: Food[] = [];
    const ingredients = recipe.ingredients
      .filter((i) => i.food.trim() && i.quantity > 0)
      .map((ing) => {
        const existing = foods.find((f) => normalizeName(f.name) === normalizeName(ing.food));
        if (existing) return { foodId: existing.id, quantity: ing.quantity };
        const id = newId();
        const map = mapCategory(ing.category);
        newFoods.push({ id, name: ing.food.trim(), unit: ing.unit, caloriesPerUnit: 0, protein: 0, carbs: 0, fat: 0, location: map.location, category: map.category, emoji: map.emoji, source: "manual" });
        return { foodId: id, quantity: ing.quantity };
      });
    addRecipe(
      { id: newId(), name: recipe.name.trim(), emoji: recipe.emoji || "🍽️", servings: Math.max(1, recipe.servings), ingredients, steps: recipe.steps, category: recipe.meal },
      newFoods,
    );
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-emerald-400" /> Scan recipe</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-zinc-400">Photograph a recipe card or cookbook page. Claude reads the title, ingredients and steps into an editable recipe you can save to your cookbook.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm font-medium hover:border-emerald-400/60 hover:bg-emerald-500/10">
                  <Camera size={26} className="text-emerald-400" /> Take a photo
                </button>
                <button onClick={() => { fileRef.current?.removeAttribute("capture"); fileRef.current?.click(); }} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm font-medium hover:border-emerald-400/60 hover:bg-emerald-500/10">
                  <Upload size={26} className="text-emerald-400" /> Upload a photo
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button onClick={() => run(demoScanRecipe())} className="w-full rounded-xl border border-dashed border-white/15 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.04]">Try a sample recipe (no key needed)</button>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <button onClick={() => setShowKey((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium text-zinc-300">
                  <KeyRound size={15} className="text-zinc-400" /> Anthropic API key {apiKey ? <span className="text-xs text-emerald-400">· set</span> : <span className="text-xs text-zinc-500">· not set</span>}
                </button>
                {showKey && (
                  <div className="mt-2 space-y-2">
                    <input type="password" value={apiKey} onChange={(e) => saveKey(e.target.value)} placeholder="sk-ant-..." className="w-full rounded-lg field px-3 py-2 text-sm" />
                    <p className="text-[11px] leading-4 text-zinc-500">Stored only in this browser, sent straight to Anthropic. Real scanning is paid per use.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-zinc-400"><Loader2 size={30} className="animate-spin text-emerald-400" /> Reading your recipe…</div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle size={34} className="text-rose-400" />
              <p className="max-w-sm text-sm text-zinc-300">{error}</p>
              <button onClick={() => setStep("upload")} className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">Try again</button>
            </div>
          )}

          {step === "review" && recipe && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <input value={recipe.emoji} onChange={(e) => patch({ emoji: e.target.value })} className="w-14 rounded-lg field px-2 py-2 text-center text-xl" />
                <input value={recipe.name} onChange={(e) => patch({ name: e.target.value })} className="flex-1 rounded-lg field px-3 py-2 font-medium" />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><span className="text-zinc-500">Servings</span>
                  <input type="number" value={recipe.servings} onChange={(e) => patch({ servings: Number(e.target.value) })} className="w-20 rounded-lg field px-2 py-1.5" />
                </label>
                <label className="flex items-center gap-2"><span className="text-zinc-500">Meal</span>
                  <select value={recipe.meal} onChange={(e) => patch({ meal: e.target.value as MealType })} className="rounded-lg field px-2 py-1.5">
                    {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-zinc-400">Ingredients</div>
                <div className="space-y-1.5">
                  {recipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.06] p-1.5">
                      <input value={ing.food} onChange={(e) => patchIng(i, { food: e.target.value })} className="min-w-0 flex-1 rounded-lg field px-2 py-1.5 text-sm" />
                      <input type="number" value={ing.quantity} onChange={(e) => patchIng(i, { quantity: Number(e.target.value) })} className="w-16 rounded-lg field px-2 py-1.5 text-sm" />
                      <select value={ing.unit} onChange={(e) => patchIng(i, { unit: e.target.value as Unit })} className="rounded-lg field px-2 py-1.5 text-sm">
                        {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                      <select value={ing.category} onChange={(e) => patchIng(i, { category: e.target.value as (typeof CATS)[number] })} className="rounded-lg field px-2 py-1.5 text-sm">
                        {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => setRecipe((r) => (r ? { ...r, ingredients: r.ingredients.filter((_, idx) => idx !== i) } : r))} className="text-zinc-500 hover:text-rose-400"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {recipe.steps.length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-medium text-zinc-400">Steps</div>
                  <textarea value={recipe.steps.join("\n")} onChange={(e) => patch({ steps: e.target.value.split("\n") })} rows={4} className="w-full rounded-lg field px-3 py-2 text-sm" />
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep("upload")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.06]">Back</button>
                <button onClick={confirm} className="flex-1 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">Save to cookbook</button>
              </div>
              <p className="text-[11px] text-zinc-500">New ingredients are added to your kitchen with 0 nutrition — set their calories/macros in the Kitchen afterward.</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><Check size={30} /></span>
              <p className="font-semibold">Recipe saved to your cookbook</p>
              <button onClick={onClose} className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
