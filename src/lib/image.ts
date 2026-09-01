"use client";

/**
 * Turn a picked image file into a small data URL we can store.
 *
 * Recipe photos live inside the same blob as the rest of the app data, which
 * has to fit in localStorage (~5 MB) and a Firestore document (1 MB). A raw
 * phone photo is several MB on its own, so every image is drawn onto a canvas,
 * capped at MAX_EDGE, and re-encoded as JPEG — landing around 30–60 KB.
 *
 * Any format the browser can decode is accepted (JPEG, PNG, WebP, GIF, HEIC
 * where the OS supports it); the output is always JPEG.
 */
const MAX_EDGE = 900;
const QUALITY = 0.72;

export function fileToThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("That file isn't an image."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Couldn't process that image.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      } catch {
        reject(new Error("Couldn't process that image."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image couldn't be read. Try a JPG or PNG."));
    };
    img.src = url;
  });
}
