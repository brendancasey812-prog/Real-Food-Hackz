"use client";

import { useState } from "react";

const KEY_STORE = "anthropic_api_key";

/** The user's own Anthropic key, remembered only in this browser. */
export function useApiKey() {
  const [apiKey, setApiKeyState] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(KEY_STORE) ?? "" : "",
  );
  const setApiKey = (k: string) => {
    setApiKeyState(k);
    if (typeof window !== "undefined") localStorage.setItem(KEY_STORE, k.trim());
  };
  return [apiKey, setApiKey] as const;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** Validate an uploaded photo and hand back its base64 payload. */
export function readImageFile(
  file: File,
  onOk: (base64: string, type: ImageType) => void,
  onError: (message: string) => void,
) {
  if (!IMAGE_TYPES.includes(file.type as ImageType)) {
    onError("That image type isn't supported. Please use a JPG, PNG, or WebP photo.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onOk(String(reader.result).split(",")[1] ?? "", file.type as ImageType);
  reader.onerror = () => onError("Couldn't read that file. Try another photo.");
  reader.readAsDataURL(file);
}
