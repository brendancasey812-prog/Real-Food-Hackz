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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-page p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger-soft">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-ink hover:bg-surface-3">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
