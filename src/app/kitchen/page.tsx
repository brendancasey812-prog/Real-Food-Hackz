"use client";

import { SettingsButton } from "@/components/SettingsButton";
import { KitchenMenu } from "@/components/KitchenMenu";
import { Fridge } from "@/components/Fridge";

export default function Kitchen() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Food Tracker</h1>
          <p className="mt-1 text-sm text-muted">
            Open a shelf to see what&apos;s in it · tap a food to set how much you have,
            price it, move it or edit it.
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <KitchenMenu context="kitchen" />
          <SettingsButton className="hidden md:flex" />
        </div>
      </header>

      <Fridge />
    </div>
  );
}
