"use client";

import { AlertTriangle } from "lucide-react";

/** A small "are you sure?" modal used before any destructive delete. */
export function ConfirmDialog({
  title = "Delete this?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-100">{title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-900/30 hover:brightness-110">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
