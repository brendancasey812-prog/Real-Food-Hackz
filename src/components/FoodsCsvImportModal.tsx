"use client";

import { useEffect, useState } from "react";
import { X, FileSpreadsheet, Check, TriangleAlert } from "lucide-react";
import { useApp, newId } from "@/lib/store";
import { csvToFoods, matchExistingFood, type FoodImportRow } from "@/lib/foodsio";

type Step = "reading" | "review" | "done" | "error";

/**
 * Import a food catalog CSV — either one this app exported, or one built by
 * hand in a spreadsheet with the same headers. Works with no API key and no
 * network, same as the receipt/recipe CSV round trip.
 *
 * A row whose name matches an existing food (by normalized name, same match
 * a receipt scan uses) updates its nutrition and stock rather than
 * duplicating it; everything else becomes a new food. Nothing about shelf
 * placement is overwritten for a food that already exists — only the
 * numbers a spreadsheet is actually good for editing.
 */
export function FoodsCsvImportModal({ file, onClose }: { file: File; onClose: () => void }) {
  const { foods, addFood, updateFood, setInventory } = useApp();
  const [step, setStep] = useState<Step>("reading");
  const [rows, setRows] = useState<FoodImportRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ added: 0, updated: 0 });

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      const { items, errors: errs } = csvToFoods(String(reader.result ?? ""));
      if (items.length === 0) {
        setError(errs[0]?.message ?? "That CSV had no readable rows.");
        setStep("error");
        return;
      }
      setRows(items);
      setErrors(errs);
      setStep("review");
    };
    reader.onerror = () => { setError("Couldn't read that file. Try again."); setStep("error"); };
    reader.readAsText(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const willAdd = rows.filter((r) => !matchExistingFood(foods, r.name)).length;
  const willUpdate = rows.length - willAdd;

  const confirm = () => {
    let added = 0, updated = 0;
    for (const r of rows) {
      const existing = matchExistingFood(foods, r.name);
      if (existing) {
        updateFood(existing.id, {
          caloriesPerUnit: r.caloriesPerUnit,
          protein: r.protein,
          carbs: r.carbs,
          fat: r.fat,
          notes: r.notes ?? existing.notes,
        });
        setInventory(existing.id, r.quantity);
        updated++;
      } else {
        addFood(
          {
            id: newId(),
            name: r.name,
            unit: r.unit,
            caloriesPerUnit: r.caloriesPerUnit,
            protein: r.protein,
            carbs: r.carbs,
            fat: r.fat,
            location: r.location,
            category: r.category,
            source: "manual",
            notes: r.notes,
          },
          r.quantity,
        );
        added++;
      }
    }
    setSummary({ added, updated });
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex sheet-max w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet size={18} className="text-accent-soft" /> Import foods
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-own p-5">
          {step === "reading" && <p className="text-sm text-muted">Reading {file.name}…</p>}

          {step === "error" && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger-soft">{error}</p>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Found <span className="font-medium text-ink">{rows.length}</span> row{rows.length === 1 ? "" : "s"} in {file.name}:{" "}
                <span className="text-ink-2">{willAdd} new food{willAdd === 1 ? "" : "s"}</span>,{" "}
                <span className="text-ink-2">{willUpdate} updated</span>.
              </p>
              <p className="text-[11px] leading-4 text-muted">
                A row matching an existing food (by name) updates its calories, macros and how much
                you have — shelf and category are left as they are. Everything else is added new.
              </p>

              {errors.length > 0 && (
                <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-[11px] leading-4 text-warn-soft">
                  <p className="flex items-start gap-2 font-medium">
                    <TriangleAlert size={13} className="mt-px shrink-0" />
                    {errors.length} row{errors.length === 1 ? "" : "s"} couldn&apos;t be read and{" "}
                    {errors.length === 1 ? "was" : "were"} skipped:
                  </p>
                  <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] text-muted">
                    {errors.slice(0, 20).map((e, i) => (
                      <li key={i}>row {e.row}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  className="flex-1 rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110"
                >
                  Import {rows.length} food{rows.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft"><Check size={30} /></span>
              <div>
                <p className="font-semibold">Kitchen updated</p>
                <p className="mt-1 text-sm text-muted">
                  {summary.added} new food{summary.added === 1 ? "" : "s"} · {summary.updated} updated
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
