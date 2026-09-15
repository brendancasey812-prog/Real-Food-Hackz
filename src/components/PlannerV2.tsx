"use client";

import { useMemo, useRef, useState } from "react";
import { format, addDays } from "date-fns";
import {
  Plus, ChevronDown, ChevronLeft, ChevronRight, Camera, PenLine, ClipboardList, Wand2,
  ImagePlus, Loader2, Trash2, UtensilsCrossed, Flame,
} from "lucide-react";
import { useApp, newId, recipeCaloriesPerServing } from "@/lib/store";
import { householdSize } from "@/lib/household";
import { weekDays, isoOf, MEAL_LABEL } from "@/lib/week";
import { MEAL_COLOR } from "@/lib/mealtime";
import { recipeEmoji } from "@/lib/foodcat";
import { fileToThumbnail } from "@/lib/image";
import { ViewToggle } from "./shelf";
import { RecipePickerSheet } from "./RecipePickerSheet";
import { MealDetailModal } from "./MealDetailModal";
import { RecipeScanModal } from "./RecipeScanModal";
import { AddRecipeModal } from "./AddRecipeModal";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Food, MealCardStyle, MealType, PlannedMeal, Recipe } from "@/lib/types";

type Scope = "day" | "custom" | "week";

/** The three sittings every day gets a card for. Snack/Extra only show up on
 *  a day that already has one planned, so the grid doesn't pad itself out
 *  with slots most people never use. */
const CORE_MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

/**
 * Meal Plan V2: a photo-forward (or text, or emoji) card grid, three across
 * on a wide screen, in place of the classic hour-by-hour calendar.
 *
 * It reads and writes the exact same `plan`/`recipes`/`foods` the classic
 * view does — opening a card's meal reuses MealDetailModal (the same
 * ingredient editor, with the same tap-to-open-FoodSheet linkage back to the
 * Food Tracker), and an empty slot reuses the same recipe picker the Create
 * Meal Plan wizard uses. Nothing here is a second copy of planning data or
 * planning logic, only a second way to look at it.
 */
export function PlannerV2() {
  const {
    recipes, foods, plan, addPlannedMeal, removePlannedMeal,
    householdMode, members, mealCardStyle, setMealCardStyle,
  } = useApp();
  const size = householdSize({ householdMode, members });
  const cookbook = useMemo(() => recipes.filter((r) => !r.single), [recipes]);
  const style: MealCardStyle = mealCardStyle ?? "photo";

  const [anchor, setAnchor] = useState(() => new Date());
  const [scope, setScope] = useState<Scope>("week");
  const [chosenDays, setChosenDays] = useState<Set<string>>(() => new Set(weekDays(new Date()).map(isoOf)));

  const [addMenu, setAddMenu] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ iso: string; meal: MealType } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const week = useMemo(() => weekDays(anchor), [anchor]);

  // Navigating to a week that hasn't been customized yet starts it fully
  // checked, rather than landing on an accidentally empty custom view. This
  // adjusts state during render (React's own pattern for "reset on prop
  // change") rather than in an effect, so it takes effect in the same pass.
  const weekKey = isoOf(week[0]);
  const [lastWeekKey, setLastWeekKey] = useState(weekKey);
  if (weekKey !== lastWeekKey) {
    setLastWeekKey(weekKey);
    setChosenDays(new Set(week.map(isoOf)));
  }

  const daysInScope = useMemo(() => {
    if (scope === "day") return [anchor];
    if (scope === "week") return week;
    return week.filter((d) => chosenDays.has(isoOf(d)));
  }, [scope, anchor, week, chosenDays]);

  const shift = (dir: number) => setAnchor((a) => addDays(a, scope === "day" ? dir : dir * 7));

  const title = scope === "day"
    ? format(anchor, "EEEE, MMM d, yyyy")
    : `${format(week[0], "MMM d")} – ${format(week[6], week[0].getMonth() === week[6].getMonth() ? "d" : "MMM d")}, ${format(week[6], "yyyy")}`;

  const toggleDay = (iso: string) =>
    setChosenDays((s) => {
      const n = new Set(s);
      if (n.has(iso)) n.delete(iso); else n.add(iso);
      return n;
    });

  /** Core three, plus any meal this day already has outside them. */
  const mealTypesFor = (iso: string): MealType[] => {
    const extra = (["snack", "extra"] as MealType[]).filter((mt) =>
      plan.some((m) => m.date === iso && m.mealType === mt),
    );
    return [...CORE_MEALS, ...extra];
  };

  const askRemove = (meal: PlannedMeal) => {
    const r = recipes.find((x) => x.id === meal.recipeId);
    setConfirmRemove({ id: meal.id, name: r?.name ?? "this meal" });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle value={scope} onChange={setScope} options={[["day", "Day"], ["custom", "Custom"], ["week", "Week"]] as const} />
          <div className="flex items-center gap-0.5">
            <button onClick={() => shift(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-ink">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setAnchor(new Date())} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-3">
              Today
            </button>
            <button onClick={() => shift(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-ink">
              <ChevronRight size={18} />
            </button>
          </div>
          <span className="text-sm text-muted">{title}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle value={style} onChange={setMealCardStyle} options={[["photo", "Photo"], ["text", "Text"], ["emoji", "Emoji"]] as const} />

          <div className="relative shrink-0">
            <button
              onClick={() => setAddMenu((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-accent-deep px-4 py-2 text-sm font-medium text-on-accent shadow-lg hover:brightness-110"
            >
              <Plus size={16} /> Add recipe <ChevronDown size={14} />
            </button>
            {addMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAddMenu(false)} />
                <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-line bg-page p-1 shadow-xl">
                  <button onClick={() => { setAddMenu(false); setAiOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                    <Wand2 size={16} className="text-accent-soft" /> Build with AI
                  </button>
                  <button onClick={() => { setAddMenu(false); setScanOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                    <Camera size={16} className="text-accent-soft" /> Scan recipe (camera)
                  </button>
                  <button onClick={() => { setAddMenu(false); setTextOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                    <ClipboardList size={16} className="text-accent-soft" /> Paste text (AI)
                  </button>
                  <button onClick={() => { setAddMenu(false); setManualOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-accent-wash">
                    <PenLine size={16} className="text-accent-soft" /> Manually enter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {scope === "custom" && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {week.map((d) => {
            const iso = isoOf(d);
            const on = chosenDays.has(iso);
            return (
              <button
                key={iso}
                onClick={() => toggleDay(iso)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  on ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "border border-line text-muted hover:bg-surface-3"
                }`}
              >
                {format(d, "EEE d")}
              </button>
            );
          })}
        </div>
      )}

      {daysInScope.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No days selected — pick at least one above.</p>
      ) : (
        <div className={scope === "day" ? "space-y-3" : "space-y-8"}>
          {daysInScope.map((d) => {
            const iso = isoOf(d);
            return (
              <section key={iso}>
                {scope !== "day" && <h2 className="mb-3 text-lg font-semibold text-ink">{format(d, "EEEE, MMM d")}</h2>}
                <div className={scope === "day" ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
                  {mealTypesFor(iso).map((mt) => {
                    const meal = plan.find((m) => m.date === iso && m.mealType === mt);
                    const recipe = meal ? recipes.find((r) => r.id === meal.recipeId) : undefined;
                    return (
                      <MealCardV2
                        key={mt}
                        mealType={mt}
                        meal={meal}
                        recipe={recipe}
                        foods={foods}
                        recipes={recipes}
                        style={style}
                        wide={scope === "day"}
                        onOpen={() => meal && setOpenMealId(meal.id)}
                        onAdd={() => setSlot({ iso, meal: mt })}
                        onRemove={() => meal && askRemove(meal)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {openMealId && <MealDetailModal mealId={openMealId} onClose={() => setOpenMealId(null)} />}

      {slot && (
        <RecipePickerSheet
          meal={slot.meal}
          date={slot.iso}
          candidates={cookbook.filter((r) => r.category === slot.meal)}
          foods={foods}
          allRecipes={recipes}
          current={undefined}
          onPick={(id) => {
            addPlannedMeal({ id: newId(), date: slot.iso, mealType: slot.meal, recipeId: id, servings: size });
            setSlot(null);
          }}
          onClear={() => setSlot(null)}
          onClose={() => setSlot(null)}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove meal?"
          message={`“${confirmRemove.name}” will be removed from this day. The recipe stays in your cookbook.`}
          confirmLabel="Remove"
          onConfirm={() => { removePlannedMeal(confirmRemove.id); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {manualOpen && <AddRecipeModal onClose={() => setManualOpen(false)} />}
      {scanOpen && <RecipeScanModal mode="photo" onClose={() => setScanOpen(false)} />}
      {textOpen && <RecipeScanModal mode="text" onClose={() => setTextOpen(false)} />}
      {aiOpen && <RecipeScanModal mode="ai" onClose={() => setAiOpen(false)} />}
    </div>
  );
}

function MealCardV2({
  mealType, meal, recipe, foods, recipes, style, wide = false, onOpen, onAdd, onRemove,
}: {
  mealType: MealType;
  meal: PlannedMeal | undefined;
  recipe: Recipe | undefined;
  foods: Food[];
  recipes: Recipe[];
  style: MealCardStyle;
  /** Day view: one full-width card instead of one of a row of three — a
   *  wider, flatter photo fills that width without towering over the page. */
  wide?: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { updateRecipe } = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const color = MEAL_COLOR[mealType];

  if (!meal || !recipe) {
    return (
      <button
        onClick={onAdd}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-2 p-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent-soft ${wide ? "min-h-[120px]" : "min-h-[160px]"}`}
      >
        <Plus size={22} />
        Add {MEAL_LABEL[mealType].toLowerCase()}
      </button>
    );
  }

  const cal = Math.round(recipeCaloriesPerServing(recipe, foods, recipes) * meal.servings);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      updateRecipe({ ...recipe, image: await fileToThumbnail(file) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent">
      <button
        onClick={onRemove}
        aria-label={`Remove ${recipe.name}`}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-scrim text-on-accent opacity-0 backdrop-blur-sm transition group-hover/card:opacity-100"
      >
        <Trash2 size={13} />
      </button>

      {style === "photo" && (
        <div className={`relative w-full cursor-pointer overflow-hidden bg-page ${wide ? "aspect-[21/9]" : "aspect-[16/10]"}`} onClick={onOpen}>
          {recipe.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URLs, no optimizer
            <img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-page text-faint">
              <UtensilsCrossed size={wide ? 40 : 28} />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            disabled={busy}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-scrim px-2.5 py-1.5 text-xs font-medium text-on-accent backdrop-blur-sm disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {recipe.image ? "Replace" : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
      )}

      {style === "emoji" && (
        <button
          onClick={onOpen}
          className={`flex w-full items-center justify-center bg-gradient-to-br from-surface-2 to-page leading-none ${wide ? "aspect-[21/9] text-8xl" : "aspect-[16/10] text-6xl"}`}
        >
          {recipeEmoji(recipe, foods)}
        </button>
      )}

      <button onClick={onOpen} className="flex flex-1 flex-col p-4 text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span className={`h-2 w-2 rounded-full ${color.dot}`} />
          {MEAL_LABEL[mealType]}
        </span>
        <h3 className={`mt-1 line-clamp-2 font-semibold leading-snug text-ink ${wide ? "text-lg" : ""}`}>{recipe.name}</h3>
        <span className="mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-cal-soft">
          <Flame size={13} /> {cal.toLocaleString()} cal
        </span>
      </button>
    </div>
  );
}
