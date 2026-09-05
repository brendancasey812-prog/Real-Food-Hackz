"use client";

import { useRef, useState } from "react";
import { X, Camera, Upload, Loader2, Trash2, Sparkles, KeyRound, AlertCircle, Check } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { scanRecipe, demoScanRecipe, buildRecipeFromText, parseTextLocally, SERVER_AI, type ScannedRecipe } from "@/lib/recipescan";
import { normalizeName, mapCategory, ReceiptError } from "@/lib/receipt";
import { convertUnits } from "@/lib/foodtable";
import { UNITS, fmtQty } from "@/lib/units";
import { MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import type { Food, MealType, Unit } from "@/lib/types";

type Step = "upload" | "loading" | "review" | "done" | "error";
const KEY_STORE = "anthropic_api_key";
const OK_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const CATS = ["Protein", "Fruit", "Veggie", "Pantry"] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function RecipeScanModal({ onClose, mode = "photo" }: { onClose: () => void; mode?: "photo" | "text" }) {
  const { foods, addRecipe, updateFood } = useApp();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState<ScannedRecipe | null>(null);
  const [apiKey, setApiKey] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(KEY_STORE) ?? "" : ""));
  const [showKey, setShowKey] = useState(false);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // The server proxy handles AI when this build has one; otherwise we need the
  // user's own key, and failing that we fall back to the local parser.
  const aiAvailable = SERVER_AI || apiKey.trim() !== "";

  const buildFromText = () => {
    if (!text.trim()) { setError("Paste a recipe, ingredient list, or food table first."); setStep("error"); return; }
    setNotice("");
    if (!aiAvailable) { run(Promise.resolve(parseTextLocally(text))); return; }
    // If Claude can't be reached, a structured paste can still be read locally
    // rather than dead-ending the user on an error screen.
    run(
      buildRecipeFromText(apiKey.trim(), text).catch((e) => {
        const local = parseTextLocally(text);
        if (local.ingredients.length < 2) throw e;
        setNotice("Couldn't reach Claude, so this was read locally from the table. Check the numbers below.");
        return local;
      }),
    );
  };

  const saveKey = (k: string) => { setApiKey(k); if (typeof window !== "undefined") localStorage.setItem(KEY_STORE, k.trim()); };

  const run = async (p: Promise<ScannedRecipe>) => {
    setStep("loading");
    try { setRecipe(await p); setStep("review"); }
    catch (e) { setError(e instanceof ReceiptError ? e.message : "Something went wrong reading the recipe."); setStep("error"); }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!OK_TYPES.includes(file.type as (typeof OK_TYPES)[number])) { setError("Use a JPG, PNG, or WebP photo."); setStep("error"); return; }
    if (!aiAvailable) { setError("Add your Anthropic API key in Settings to scan a photo — or tap “Try a sample”."); setStep("error"); return; }
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
        if (existing) {
          // The scan's unit and the stocked food's unit needn't agree (3 tsp
          // scanned, the food lives in tbsp) — convert instead of mixing them.
          const factor = convertUnits(1, ing.unit, existing.unit);
          const quantity = round2(ing.quantity * (factor ?? 1));
          // Fill in nutrition the kitchen is missing, scaled to the food's unit.
          if (factor && ing.caloriesPerUnit && !existing.caloriesPerUnit) {
            updateFood(existing.id, {
              caloriesPerUnit: round2(ing.caloriesPerUnit / factor),
              protein: existing.protein || round2((ing.protein ?? 0) / factor),
              carbs: existing.carbs || round2((ing.carbs ?? 0) / factor),
              fat: existing.fat || round2((ing.fat ?? 0) / factor)
            });
          }
          return { foodId: existing.id, quantity };
        }
        const id = newId();
        const map = mapCategory(ing.category, ing.food);
        newFoods.push({
          id,
          name: ing.food.trim(),
          unit: ing.unit,
          caloriesPerUnit: round2(ing.caloriesPerUnit ?? 0),
          protein: round2(ing.protein ?? 0),
          carbs: round2(ing.carbs ?? 0),
          fat: round2(ing.fat ?? 0),
          location: map.location,
          category: map.category,
          source: "manual",
          notes: ing.note
        });
        return { foodId: id, quantity: ing.quantity };
      });
    addRecipe(
      { id: newId(), name: recipe.name.trim(), servings: Math.max(1, recipe.servings), ingredients, steps: recipe.steps, category: recipe.meal },
      newFoods,
    );
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-accent-soft" /> {mode === "text" ? "Paste a recipe" : "Scan recipe"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-5">
              {mode === "text" ? (
                <>
                  <p className="text-sm text-muted">Paste an ingredient list — one item per line (“2 eggs”, “1 cup oats”) — or a whole food table copied out of a spreadsheet or doc. Columns for quantity, unit, serving size and calories are read as columns, TOTAL and PER SERVING rows set the servings, and the calories land on each food.</p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={7}
                    placeholder={"6 oz firm tofu\n1 cup spinach\n2 corn tortillas\n\n— or paste a table —\n\nFood\tQuantity\tUnit\tCalories per Unit\nGround Beef 80/20\t16\toz\t70\nMarinara Sauce\t2.5\tcups\t80"}
                    className="w-full rounded-xl field px-3 py-2 text-sm"
                  />
                  <button onClick={buildFromText} className="w-full rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
                    Build recipe {aiAvailable ? "with Claude" : "(basic, no key)"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">Photograph a recipe card or cookbook page. Claude reads the title, ingredients and steps into an editable recipe you can save to your cookbook.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button onClick={() => { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-8 text-sm font-medium hover:border-accent hover:bg-accent-wash">
                      <Camera size={26} className="text-accent-soft" /> Take a photo
                    </button>
                    <button onClick={() => { fileRef.current?.removeAttribute("capture"); fileRef.current?.click(); }} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-8 text-sm font-medium hover:border-accent hover:bg-accent-wash">
                      <Upload size={26} className="text-accent-soft" /> Upload a photo
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                  <button onClick={() => run(demoScanRecipe())} className="w-full rounded-xl border border-dashed border-line-2 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">Try a sample recipe (no key needed)</button>
                </>
              )}
              <div className="rounded-xl border border-line bg-surface p-3">
                <button onClick={() => setShowKey((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium text-ink-2">
                  <KeyRound size={15} className="text-muted" /> Anthropic API key {apiKey ? <span className="text-xs text-accent-soft">· set</span> : <span className="text-xs text-muted">· not set</span>}
                </button>
                {showKey && (
                  <div className="mt-2 space-y-2">
                    <input type="password" value={apiKey} onChange={(e) => saveKey(e.target.value)} placeholder="sk-ant-..." className="w-full rounded-lg field px-3 py-2 text-sm" />
                    <p className="text-[11px] leading-4 text-muted">Stored only in this browser, sent straight to Anthropic. Real scanning is paid per use.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted"><Loader2 size={30} className="animate-spin text-accent-soft" /> Reading your recipe…</div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle size={34} className="text-danger-soft" />
              <p className="max-w-sm text-sm text-ink-2">{error}</p>
              <button onClick={() => setStep("upload")} className="rounded-xl bg-gradient-to-b from-accent to-accent-deep px-5 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">Try again</button>
            </div>
          )}

          {step === "review" && recipe && (
            <div className="space-y-4">
              {notice && (
                <p className="rounded-lg border border-warn/40 bg-warn/12 px-3 py-2 text-xs text-warn-soft">{notice}</p>
              )}
              <input value={recipe.name} onChange={(e) => patch({ name: e.target.value })} className="w-full rounded-lg field px-3 py-2 font-medium" />
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><span className="text-muted">Servings</span>
                  <input type="number" value={recipe.servings} onChange={(e) => patch({ servings: Number(e.target.value) })} className="w-20 rounded-lg field px-2 py-1.5" />
                </label>
                <label className="flex items-center gap-2"><span className="text-muted">Meal</span>
                  <select value={recipe.meal} onChange={(e) => patch({ meal: e.target.value as MealType })} className="rounded-lg field px-2 py-1.5">
                    {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-muted">Ingredients</div>
                <div className="space-y-1.5">
                  {recipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line p-1.5">
                      <input value={ing.food} onChange={(e) => patchIng(i, { food: e.target.value })} className="min-w-0 flex-1 rounded-lg field px-2 py-1.5 text-sm" />
                      <input
                        type="number"
                        value={ing.quantity === 0 ? "" : ing.quantity}
                        placeholder="?"
                        onChange={(e) => patchIng(i, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
                        className={`w-16 rounded-lg field px-2 py-1.5 text-sm ${ing.quantity === 0 ? "border-warn bg-warn/12 placeholder:text-warn-soft" : ""}`}
                      />
                      <select value={ing.unit} onChange={(e) => patchIng(i, { unit: e.target.value as Unit })} className="rounded-lg field px-2 py-1.5 text-sm">
                        {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                      <select value={ing.category} onChange={(e) => patchIng(i, { category: e.target.value as (typeof CATS)[number] })} className="rounded-lg field px-2 py-1.5 text-sm">
                        {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] text-muted" title={`Calories in one ${ing.unit}`}>
                        <input
                          type="number"
                          value={ing.caloriesPerUnit ?? ""}
                          placeholder="—"
                          onChange={(e) => patchIng(i, { caloriesPerUnit: e.target.value === "" ? undefined : Number(e.target.value) })}
                          className="w-16 rounded-lg field px-2 py-1.5 text-sm"
                        />
                        cal/{ing.unit}
                      </label>
                      <button onClick={() => setRecipe((r) => (r ? { ...r, ingredients: r.ingredients.filter((_, idx) => idx !== i) } : r))} className="text-muted hover:text-danger-soft"><Trash2 size={14} /></button>
                      {(() => {
                        // Say so when the kitchen already stocks this food in a
                        // different unit — silently reinterpreting "1 tsp" as
                        // "1 each" is how a list stops adding up.
                        const existing = foods.find((f) => normalizeName(f.name) === normalizeName(ing.food));
                        const factor = existing && existing.unit !== ing.unit ? convertUnits(1, ing.unit, existing.unit) : null;
                        const clash = existing && existing.unit !== ing.unit;
                        return (
                          <span className="w-full pl-1 text-[11px] text-muted">
                            {ing.note}
                            {ing.note && clash ? " · " : ""}
                            {clash && (
                              <span className={factor ? "text-muted" : "text-warn-soft"}>
                                {factor
                                  ? `your kitchen stocks ${existing!.name} in ${existing!.unit} — saving ${fmtQty(round2(ing.quantity * factor))} ${existing!.unit}`
                                  : `your kitchen stocks ${existing!.name} in ${existing!.unit}, which can't convert from ${ing.unit} — it will be saved as ${fmtQty(ing.quantity)} ${existing!.unit}`}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>

              {recipe.steps.length > 0 && (
                <div>
                  <div className="mb-1 text-sm font-medium text-muted">Steps</div>
                  <textarea value={recipe.steps.join("\n")} onChange={(e) => patch({ steps: e.target.value.split("\n") })} rows={4} className="w-full rounded-lg field px-3 py-2 text-sm" />
                </div>
              )}

              {(() => {
                const blanks = recipe.ingredients.filter((i) => i.quantity <= 0).length;
                const total = recipe.ingredients.reduce((sum, i) => sum + (i.caloriesPerUnit ?? 0) * i.quantity, 0);
                const servings = Math.max(1, recipe.servings || 1);
                const claimed = recipe.declaredTotalCalories;
                // Flag a >2% gap between our math and the total the source printed.
                const off = total > 0 && claimed ? Math.abs(total - claimed) / claimed > 0.02 : false;
                return (
                  <>
                    {total > 0 && (
                      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-medium text-ink">{Math.round(total).toLocaleString()} cal total</span>
                          <span className="text-muted">{Math.round(total / servings).toLocaleString()} per serving × {fmtQty(servings)}</span>
                        </div>
                        {claimed !== undefined && (
                          <div className={`mt-1 ${off ? "text-warn-soft" : "text-muted"}`}>
                            {off
                              ? `Your list says ${Math.round(claimed).toLocaleString()} cal — ${Math.round(Math.abs(total - claimed)).toLocaleString()} off from the per-item math. Check the highlighted quantities.`
                              : `Matches the ${Math.round(claimed).toLocaleString()} cal total on your list.`}
                          </div>
                        )}
                      </div>
                    )}
                    {blanks > 0 && (
                      <p className="rounded-lg border border-warn/40 bg-warn/12 px-3 py-2 text-xs text-warn-soft">
                        {blanks} ingredient{blanks > 1 ? "s need" : " needs"} a quantity (highlighted in amber). Enter or delete them to save.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setStep("upload")} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">Back</button>
                      <button
                        onClick={confirm}
                        disabled={blanks > 0}
                        className="flex-1 rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Save to cookbook
                      </button>
                    </div>
                  </>
                );
              })()}
              <p className="text-[11px] text-muted">New ingredients join your kitchen with the calories shown above; leave one blank and you can set it in the Food Tracker later.</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft"><Check size={30} /></span>
              <p className="font-semibold">Recipe saved to your cookbook</p>
              <button onClick={onClose} className="rounded-xl bg-gradient-to-b from-accent to-accent-deep px-6 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
