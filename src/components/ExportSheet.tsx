"use client";

import { useEffect, useState } from "react";
import { X, Download, Copy, Check } from "lucide-react";
import { copyText, download } from "@/lib/exportfile";

export interface ExportFormat {
  key: string;
  label: string;
  /** One line on what this format is good for. */
  hint: string;
  ext: string;
  mime: string;
  /** Built when the format is chosen, so nothing is computed until asked for. */
  build: () => string;
}

/**
 * Getting something out of the app: pick a shape, then save the file or take
 * the text. The preview is the actual export, not a description of it — the
 * point of a plain-text plan is that you can read it before you send it.
 */
export function ExportSheet({
  title, subtitle, formats, filenameFor, onClose,
}: {
  title: string;
  subtitle: string;
  formats: ExportFormat[];
  filenameFor: (f: ExportFormat) => string;
  onClose: () => void;
}) {
  const [key, setKey] = useState(formats[0]?.key ?? "");
  const [copied, setCopied] = useState(false);
  const active = formats.find((f) => f.key === key) ?? formats[0];
  const content = active ? active.build() : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-page md:rounded-3xl"
      >
        <div className="shrink-0 px-5 pt-4">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              <p className="text-xs text-muted">{subtitle}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {formats.map((f) => (
              <button
                key={f.key}
                onClick={() => setKey(f.key)}
                aria-pressed={f.key === active.key}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  f.key === active.key
                    ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
                    : "border border-line text-ink-2 hover:bg-surface-3"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">{active.hint}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          <pre className="whitespace-pre overflow-x-auto rounded-xl border border-line bg-surface p-3 text-[11px] leading-4 text-ink-2">
            {content}
          </pre>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-line px-5 py-4">
          <button
            onClick={async () => setCopied(await copyText(content))}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink-2 hover:bg-surface-3"
          >
            {copied ? <Check size={15} className="text-accent-soft" /> : <Copy size={15} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => download(filenameFor(active), active.mime, content)}
            className="btn-accent flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm"
          >
            <Download size={16} /> Download {active.ext.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
