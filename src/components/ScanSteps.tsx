"use client";

import { useState } from "react";
import { KeyRound, Loader2, AlertCircle } from "lucide-react";

/** Collapsible box for entering and remembering the user's own Anthropic key. */
export function ApiKeyBox({
  apiKey, onChange, note,
}: {
  apiKey: string;
  onChange: (v: string) => void;
  note: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <button onClick={() => setShow((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium text-ink-2">
        <KeyRound size={15} className="text-muted" />
        Anthropic API key {apiKey ? <span className="text-xs text-accent-soft">· set</span> : <span className="text-xs text-muted">· not set</span>}
      </button>
      {show && (
        <div className="mt-2 space-y-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full rounded-lg field px-3 py-2 text-sm"
          />
          <p className="text-[11px] leading-4 text-muted">{note}</p>
        </div>
      )}
    </div>
  );
}

/** The step shown while a scan request is in flight. */
export function ScanLoading({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted">
      <Loader2 size={30} className="animate-spin text-accent-soft" /> {text}
    </div>
  );
}

/** The step shown when a scan fails. */
export function ScanError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <AlertCircle size={34} className="text-danger-soft" />
      <p className="max-w-sm text-sm text-ink-2">{message}</p>
      <button onClick={onRetry} className="rounded-xl bg-gradient-to-b from-accent to-accent-deep px-5 py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
        Try again
      </button>
    </div>
  );
}
