"use client";

import { useState } from "react";
import {
  X, ChevronDown, User, Target, CreditCard, ShieldCheck, Info,
  Check, LogIn, LogOut, Cloud, CloudOff, RefreshCw, Users, Trash2, Plus,
} from "lucide-react";
import { useApp, blankMember } from "@/lib/store";
import { useCloud, type SyncStatus } from "@/lib/cloud";
import type { FocusArea, HouseholdMode, Sex } from "@/lib/types";

export const HOUSEHOLD_LABEL: Record<HouseholdMode, string> = {
  individual: "Individual",
  couple: "Couple",
  family: "Family",
};

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "syncing") return <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><RefreshCw size={12} className="animate-spin" /> Syncing…</span>;
  if (status === "synced") return <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><Cloud size={12} /> Synced</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1 text-xs text-rose-300"><CloudOff size={12} /> Error</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><CloudOff size={12} /> Offline</span>;
}

const FOCUS_AREAS: { key: FocusArea; label: string; emoji: string }[] = [
  { key: "present", label: "Be more present and focused", emoji: "🧘" },
  { key: "productive", label: "Be productive and energetic", emoji: "⚡" },
  { key: "athletic", label: "Improve athletic performance", emoji: "🏃" },
  { key: "health", label: "Improve my health", emoji: "❤️" },
  { key: "stress", label: "Manage stress levels", emoji: "🌿" },
];

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "intersex", label: "Intersex" },
];

function ageFrom(birth?: string): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

function Section({
  icon: Icon, title, subtitle, children, defaultOpen = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-100">{title}</span>
          {subtitle && <span className="block truncate text-xs text-zinc-500">{subtitle}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/[0.06] p-4">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 text-sm last:border-0">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-medium text-zinc-200">{value}</span>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    profile, focusAreas, goals, householdMode, members,
    setProfile, setFocusAreas, setHouseholdMode, addMember, updateMember, removeMember,
  } = useApp();
  const cloud = useCloud();
  const ft = Math.floor(profile.heightIn / 12);
  const inch = profile.heightIn % 12;
  const derivedAge = ageFrom(profile.birthDate);

  const setHeight = (feet: number, inches: number) =>
    setProfile({ heightIn: Math.max(0, Math.round(feet * 12 + inches)) });

  const toggleFocus = (k: FocusArea) =>
    setFocusAreas(focusAreas.includes(k) ? focusAreas.filter((f) => f !== k) : [...focusAreas, k]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200" aria-label="Close settings"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {/* My Profile */}
          <Section icon={User} title="My Profile" subtitle="Birth date, height, weight, sex" defaultOpen>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-400">Birth date</span>
                <input
                  type="date"
                  value={profile.birthDate ?? ""}
                  onChange={(e) => setProfile({ birthDate: e.target.value, age: ageFrom(e.target.value) ?? profile.age })}
                  className="w-full rounded-lg field px-3 py-2 text-sm"
                />
                {derivedAge != null && <span className="mt-1 block text-[11px] text-zinc-500">Age: {derivedAge}</span>}
              </label>

              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-400">Height</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} value={ft} onChange={(e) => setHeight(Number(e.target.value) || 0, inch)} className="w-16 rounded-lg field px-2 py-2 text-sm" />
                    <span className="text-xs text-zinc-500">ft</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={11} value={inch} onChange={(e) => setHeight(ft, Number(e.target.value) || 0)} className="w-16 rounded-lg field px-2 py-2 text-sm" />
                    <span className="text-xs text-zinc-500">in</span>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-400">Weight</span>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={profile.weightLb} onChange={(e) => setProfile({ weightLb: Math.max(0, Number(e.target.value) || 0) })} className="w-24 rounded-lg field px-3 py-2 text-sm" />
                  <span className="text-xs text-zinc-500">lb</span>
                </div>
              </label>

              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-400">Sex assigned at birth</span>
                <div className="flex gap-2">
                  {SEX_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setProfile({ sex: o.value })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        profile.sex === o.value
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                          : "border-white/10 text-zinc-300 hover:bg-white/[0.05]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* User — individual / couple / family */}
          <Section icon={Users} title="User" subtitle={HOUSEHOLD_LABEL[householdMode]} defaultOpen>
            <div className="mb-3 flex gap-2">
              {(["individual", "couple", "family"] as HouseholdMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setHouseholdMode(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    householdMode === m
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {householdMode === "individual" ? (
              <p className="text-xs leading-5 text-zinc-500">
                Planning for just you. Switch to Couple or Family to plan meals and calories for more people.
              </p>
            ) : (
              <div className="space-y-2">
                <InfoRow label="You" value={<span className="text-zinc-400">{goals.dailyCalorieTarget.toLocaleString()} cal/day</span>} />
                {members.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={m.name}
                        onChange={(e) => updateMember(m.id, { name: e.target.value })}
                        placeholder="Name"
                        className="min-w-0 flex-1 rounded-lg field px-2 py-1.5 text-sm"
                      />
                      {householdMode === "family" && (
                        <button onClick={() => removeMember(m.id)} className="shrink-0 text-zinc-500 hover:text-rose-400" aria-label={`Remove ${m.name}`}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <label className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-400">Daily calories</span>
                      <input
                        type="number" min={0} value={m.goals.dailyCalorieTarget}
                        onChange={(e) => updateMember(m.id, { goals: { ...m.goals, dailyCalorieTarget: Math.max(0, Number(e.target.value) || 0) } })}
                        className="w-24 rounded-md field px-2 py-1 text-right"
                      />
                    </label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                      {(["proteinTarget", "carbsTarget", "fatTarget"] as const).map((k, i) => (
                        <label key={k} className="flex items-center justify-between gap-1">
                          <span className={["text-rose-300/80", "text-amber-300/80", "text-sky-300/80"][i]}>{["P", "C", "F"][i]} g</span>
                          <input
                            type="number" min={0} value={m.goals[k]}
                            onChange={(e) => updateMember(m.id, { goals: { ...m.goals, [k]: Math.max(0, Number(e.target.value) || 0) } })}
                            className="w-14 rounded-md field px-1.5 py-1 text-right"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {householdMode === "family" && (
                  <button
                    onClick={() => addMember(blankMember(`Member ${members.length + 2}`, goals))}
                    className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus size={15} /> Add member
                  </button>
                )}
                <p className="pt-1 text-[11px] leading-4 text-zinc-500">
                  The dashboard adds these targets together, and new meals default to {members.length + 1} servings so one recipe feeds everyone.
                </p>
              </div>
            )}
          </Section>

          {/* Goals and focus areas */}
          <Section icon={Target} title="Goals and focus areas" subtitle={`${focusAreas.length} selected`} defaultOpen>
            <div className="space-y-1.5">
              {FOCUS_AREAS.map((f) => {
                const on = focusAreas.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFocus(f.key)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      on ? "border-emerald-500/50 bg-emerald-500/10 text-zinc-100" : "border-white/10 text-zinc-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="text-lg">{f.emoji}</span>
                    <span className="flex-1 font-medium">{f.label}</span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-emerald-400 bg-emerald-500 text-white" : "border-white/20"}`}>
                      {on && <Check size={13} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Account */}
          <Section icon={CreditCard} title="Account" subtitle={cloud.user ? (cloud.user.email ?? "Signed in") : "Membership · sign in to sync"} defaultOpen={!cloud.user && cloud.enabled}>
            <InfoRow label="Membership" value={<span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">Free plan</span>} />

            {!cloud.enabled ? (
              <>
                <InfoRow label="Signed in as" value={<span className="text-zinc-400">This device</span>} />
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  Cloud sync isn&apos;t configured for this build, so your plan lives on this device only.
                </p>
              </>
            ) : cloud.user ? (
              <>
                <InfoRow label="Signed in as" value={<span className="text-zinc-200">{cloud.user.email ?? cloud.user.uid}</span>} />
                <InfoRow label="Sync" value={<SyncBadge status={cloud.sync} />} />
                <button onClick={() => cloud.signOut()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.06]">
                  <LogOut size={15} /> Sign out
                </button>
                <p className="mt-2 text-[11px] leading-4 text-zinc-500">
                  Your meals, kitchen, and plan sync to your account — open the app on any device and it&apos;s there.
                </p>
              </>
            ) : (
              <>
                <InfoRow label="Signed in as" value={<span className="text-zinc-400">Not signed in</span>} />
                <button onClick={() => cloud.signIn()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110">
                  <LogIn size={15} /> Sign in with Google
                </button>
                <p className="mt-2 text-[11px] leading-4 text-zinc-500">
                  Signing in backs up everything you&apos;ve built here and syncs it across your devices. Your current data is uploaded — nothing is lost.
                </p>
              </>
            )}
            {cloud.error && <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{cloud.error}</p>}
          </Section>

          {/* Security and privacy */}
          <Section icon={ShieldCheck} title="Security and privacy" subtitle="Where your data lives">
            <ul className="space-y-2 text-sm text-zinc-300">
              {cloud.user ? (
                <li className="flex gap-2"><span className="text-emerald-400">•</span> You&apos;re signed in, so your meals, plans, and kitchen data are stored in your private Firestore account and synced to your devices. Only you can read them.</li>
              ) : (
                <li className="flex gap-2"><span className="text-emerald-400">•</span> You&apos;re signed out — everything is stored only in this browser and never uploaded.</li>
              )}
              <li className="flex gap-2"><span className="text-emerald-400">•</span> Your Anthropic API key stays on this device and is sent only to Anthropic when you scan or paste a recipe.</li>
              <li className="flex gap-2"><span className="text-emerald-400">•</span> No ads and no tracking. Signing out leaves your cloud copy untouched; clearing your browser removes the local one.</li>
            </ul>
          </Section>

          {/* Software information */}
          <Section icon={Info} title="Software information" subtitle="Licenses, terms, version">
            <InfoRow label="Application" value="Real Food Hackz · v1.0.0" />
            <InfoRow label="Firmware" value={<span className="text-zinc-400">Web app — n/a</span>} />
            <InfoRow label="Insights" value={<span className="text-zinc-400">Local only</span>} />
            <InfoRow label="Licenses" value={<span className="text-zinc-400">Open-source (MIT)</span>} />
            <InfoRow label="Terms of use" value={<span className="text-zinc-400">Personal use</span>} />
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Built with Next.js and open-source libraries. Provided as-is for personal meal planning; no warranty.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
