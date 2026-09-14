"use client";

import { useState } from "react";
import { format } from "date-fns";
import { X, Search, Check } from "lucide-react";
import { recipeCaloriesPerServing } from "@/lib/store";
import { MEAL_LABEL } from "@/lib/week";
import type { Food, MealType, Recipe } from "@/lib/types";

/**
 * Assign a recipe to one day + meal slot — search the Cookbook, filtered to
 * that meal, with the current pick (if any) highlighted and a way to clear
 * it. Shared by the Create Meal Plan wizard and the Meal Plan V2 grid so
 * "pick something for this slot" looks and behaves the same everywhere.
 */
export function RecipePickerSheet({
  meal, date, candidates, foods, allRecipes, current, onPick, onClear, onClose,
}: {
  meal: MealType;
  date: string;
  candidates: Recipe[];
  foods: Food[];
  allRecipes: Recipe[];
  current: string | undefined;
  onPick: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = q ? candidates.filter((r) => r.name.toLowerCase().includes(q)) : candidates;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-semibold">{MEAL_LABEL[meal]} · {format(new Date(date), "EEE, MMM d")}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${MEAL_LABEL[meal].toLowerCase()} recipes…`}
              className="w-full rounded-lg field py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {current && (
            <button onClick={onClear} className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-soft hover:bg-danger/10">
              <X size={14} /> Clear this slot
            </button>
          )}
          {list.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted">
              {candidates.length === 0
                ? `No ${MEAL_LABEL[meal].toLowerCase()} recipes in your Cookbook yet.`
                : `No recipes match “${query}”.`}
            </p>
          )}
          {list.map((r) => {
            const cal = recipeCaloriesPerServing(r, foods, allRecipes);
            return (
              <button
                key={r.id}
                onClick={() => onPick(r.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent-wash ${current === r.id ? "bg-accent-wash" : ""}`}
              >
                <span className="flex items-center gap-2">
                  {current === r.id && <Check size={14} className="text-accent-soft" />}
                  {r.name}
                </span>
                <span className="text-xs text-muted">{cal} cal</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
