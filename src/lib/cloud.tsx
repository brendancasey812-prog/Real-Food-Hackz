"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged, type User
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firebaseDb, cloudEnabled } from "./firebase";
import { useApp, exportData, importData } from "./store";
import type { AppData } from "./types";

export type AuthStatus = "disabled" | "loading" | "signed-out" | "signed-in";
export type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface CloudCtx {
  enabled: boolean;
  status: AuthStatus;
  sync: SyncStatus;
  user: User | null;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<CloudCtx>({
  enabled: false, status: "disabled", sync: "idle", user: null, error: "",
  signIn: async () => {}, signOut: async () => {}
});

export const useCloud = () => useContext(Ctx);

/** Firestore rejects `undefined`; a JSON round-trip drops those keys for us. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const WRITE_DEBOUNCE_MS = 1500;

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(cloudEnabled ? "loading" : "disabled");
  const [sync, setSync] = useState<SyncStatus>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  // Guards so our own writes don't bounce back and overwrite fresher local edits.
  const applyingRemote = useRef(false);
  const lastPushed = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- auth state ---
  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStatus(u ? "signed-in" : "signed-out");
    });
  }, []);

  // --- initial pull / first-time migration, then live subscription ---
  useEffect(() => {
    const db = firebaseDb();
    if (!db || !user) return;
    const ref = doc(db, "users", user.uid);
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      setSync("syncing");
      try {
        const snap = await getDoc(ref);
        if (cancelled) return;

        if (snap.exists() && snap.data()?.data) {
          // Cloud already has this account's data — it wins on sign-in.
          const remote = snap.data().data as AppData;
          applyingRemote.current = true;
          importData(remote);
          lastPushed.current = JSON.stringify(clean(remote));
          applyingRemote.current = false;
        } else {
          // First sign-in on this account: lift whatever is already on this
          // device up to the cloud instead of starting the user from scratch.
          const local = clean(exportData());
          await setDoc(ref, { data: local, updatedAt: Date.now() });
          lastPushed.current = JSON.stringify(local);
        }
        setSync("synced");

        unsub = onSnapshot(ref, (s) => {
          const remote = s.data()?.data as AppData | undefined;
          if (!remote) return;
          const serialized = JSON.stringify(clean(remote));
          if (serialized === lastPushed.current) return; // our own write echoing back
          applyingRemote.current = true;
          importData(remote);
          lastPushed.current = serialized;
          applyingRemote.current = false;
          setSync("synced");
        }, () => setSync("error"));
      } catch (e) {
        if (!cancelled) {
          setSync("error");
          setError(e instanceof Error ? e.message : "Cloud sync failed.");
        }
      }
    })();

    return () => { cancelled = true; unsub?.(); };
  }, [user]);

  // --- push local changes (debounced) ---
  useEffect(() => {
    const db = firebaseDb();
    if (!db || !user) return;
    const ref = doc(db, "users", user.uid);

    return useApp.subscribe((state) => {
      if (applyingRemote.current) return;
      const serialized = JSON.stringify(clean(exportData(state)));
      if (serialized === lastPushed.current) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          setSync("syncing");
          lastPushed.current = serialized;
          await setDoc(ref, { data: JSON.parse(serialized), updatedAt: Date.now() });
          setSync("synced");
        } catch (e) {
          setSync("error");
          setError(e instanceof Error ? e.message : "Couldn't save to the cloud.");
        }
      }, WRITE_DEBOUNCE_MS);
    });
  }, [user]);

  const signIn = async () => {
    const auth = firebaseAuth();
    if (!auth) return;
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      if (err.code === "auth/unauthorized-domain") {
        setError("This domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains.");
        return;
      }
      setError(err.message ?? "Sign-in failed.");
    }
  };

  const signOut = async () => {
    const auth = firebaseAuth();
    if (!auth) return;
    if (timer.current) clearTimeout(timer.current);
    await fbSignOut(auth);
    setSync("idle");
    lastPushed.current = "";
  };

  return (
    <Ctx.Provider value={{ enabled: cloudEnabled, status, sync, user, error, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
