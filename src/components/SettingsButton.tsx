"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { SettingsModal } from "./SettingsModal";

/**
 * The gear that sits in the top-right of every tab. Owns its own modal state so
 * a page only has to drop it into the header.
 */
export function SettingsButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Settings"
        title="Settings"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl card text-muted transition-colors hover:text-accent-soft md:h-11 md:w-11 ${className}`}
      >
        <Settings size={19} />
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}
