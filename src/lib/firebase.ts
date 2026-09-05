"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase is optional. When the NEXT_PUBLIC_FIREBASE_* variables aren't set
 * (local dev, or a build without cloud config), every getter returns null and
 * the app runs exactly as before — entirely on localStorage.
 *
 * These values are inlined at build time and are safe to expose: a Firebase web
 * config is public by design. Your data is protected by Firestore Security
 * Rules (see SETUP.md), not by hiding these keys.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

/** True when this build was given a Firebase project to talk to. */
export const cloudEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!cloudEnabled || typeof window === "undefined") return null;
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function firebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  return a ? getAuth(a) : null;
}

export function firebaseDb(): Firestore | null {
  const a = getFirebaseApp();
  return a ? getFirestore(a) : null;
}
