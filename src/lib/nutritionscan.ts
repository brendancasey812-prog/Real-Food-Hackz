import Anthropic from "@anthropic-ai/sdk";
import { ReceiptError } from "./receipt";
import { parseUnitCell, convertUnits } from "./foodtable";
import type { Unit } from "./types";

const MODEL = "claude-opus-5";

/** Set by next.config on builds that ship API routes (Vercel, not GitHub Pages). */
export const SERVER_AI = process.env.NEXT_PUBLIC_SERVER_AI === "1";

type ImagePart = { media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

export const NUTRITION_SYSTEM_PROMPT = `You are reading a Nutrition Facts panel for a food tracking app. You will be given a photo of a food package, nutrition label, or menu nutrition listing.

Extract the numbers for ONE serving, exactly as printed. Do not compute per-container or per-100g values unless that is the only serving basis shown.

Rules:
- serving_size is the NUMBER only and serving_unit is the unit only. "Serving size 3/4 cup (55g)" → serving_size 0.75, serving_unit "cup". Prefer the household measure (cup, tbsp, piece, slice) when both it and a gram weight are printed; use the gram weight only when no household measure is given.
- If the panel shows a count like "2 cookies (30g)", use serving_size 2 and serving_unit "cookies".
- calories, protein_g, carbs_g and fat_g are per that one serving. Use total carbohydrate, not net carbs. Round to the nearest whole number.
- food_name: the product name if it is legible, otherwise an empty string.
- servings_per_container: the number if printed, otherwise null.
- If a value is genuinely not on the label, use 0 — never guess it from another product.
- If the image is not a nutrition label at all, return {"error": "short reason"}.

Return ONLY this JSON, with no other commentary:
{
  "food_name": "string",
  "serving_size": number,
  "serving_unit": "string",
  "servings_per_container": number or null,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number
}`;

export interface ScannedNutrition {
  foodName: string;
  servingSize: number;
  servingUnit: string;
  servingsPerContainer: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Per-serving figures scaled to one of the app's units. */
export interface PerUnitNutrition {
  caloriesPerUnit: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Try the server proxy first so the API key never touches the browser. Returns
 * null when this build has no proxy — the caller falls back to the user's key.
 */
async function viaServer(text: string, image: ImagePart): Promise<string | null> {
  if (!SERVER_AI) return null;
  let resp: Response;
  try {
    resp = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: NUTRITION_SYSTEM_PROMPT, text, image }),
    });
  } catch {
    return null;
  }
  if (resp.status === 501 || resp.status === 404) return null;
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ReceiptError(data.error ?? "The label service failed. Try again.");
  return typeof data.text === "string" ? data.text : null;
}

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function parseLabel(text: string): ScannedNutrition {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new ReceiptError("That label couldn't be read. Try a straight-on photo of the Nutrition Facts panel.");
    data = JSON.parse(match[0]);
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string" && obj.error) {
    throw new ReceiptError(`That doesn't look like a nutrition label — ${obj.error}`);
  }

  const scan: ScannedNutrition = {
    foodName: typeof obj.food_name === "string" ? obj.food_name.trim() : "",
    servingSize: num(obj.serving_size, 1) || 1,
    servingUnit: typeof obj.serving_unit === "string" ? obj.serving_unit.trim() : "",
    servingsPerContainer: obj.servings_per_container == null ? null : num(obj.servings_per_container) || null,
    calories: Math.round(num(obj.calories)),
    protein: Math.round(num(obj.protein_g)),
    carbs: Math.round(num(obj.carbs_g)),
    fat: Math.round(num(obj.fat_g)),
  };

  // A panel with no calories and no macros means nothing was actually read.
  if (!scan.calories && !scan.protein && !scan.carbs && !scan.fat) {
    throw new ReceiptError("No nutrition numbers were readable. Get closer to the panel and try again.");
  }
  return scan;
}

/** Read a Nutrition Facts panel from a photo (base64, no data-URL prefix). */
export async function scanNutritionLabel(
  apiKey: string,
  base64: string,
  mediaType: ImagePart["media_type"],
): Promise<ScannedNutrition> {
  const ask = "Read this nutrition label and return the JSON.";
  const image: ImagePart = { media_type: mediaType, data: base64 };

  const server = await viaServer(ask, image);
  if (server) return parseLabel(server);

  if (!apiKey) {
    throw new ReceiptError("Add your Anthropic API key in Settings to scan a label — or try the sample.");
  }
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: NUTRITION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: ask },
          ],
        },
      ],
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) throw new ReceiptError("Your Anthropic API key was rejected. Check it in Settings.");
    if (err.status === 429) throw new ReceiptError("Rate limited by Anthropic. Wait a moment and try again.");
    throw new ReceiptError(err.message ?? "Couldn't reach Anthropic. Check your connection and try again.");
  }
  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new ReceiptError("The model returned no text. Try again.");
  return parseLabel(block.text);
}

/**
 * How many of the food's own units one label serving is.
 *
 * "3 oz" against a food stocked in `oz` is 3; "85 g" is also ~3, because the
 * unit table converts weight into oz. Returns null when the two can't be
 * bridged (grams against a food stocked in cups needs a density we don't have),
 * and the UI then asks the user for the number.
 */
export function servingInUnits(
  servingSize: number,
  servingUnit: string,
  target: Unit,
): number | null {
  const parsed = parseUnitCell(servingUnit);
  if (!parsed || servingSize <= 0) return null;
  const inParsed = servingSize * parsed.factor;
  const converted = convertUnits(inParsed, parsed.unit, target);
  if (converted == null || converted <= 0) return null;
  return converted;
}

/** Divide one serving's numbers by how many app units that serving is. */
export function perUnitFrom(scan: ScannedNutrition, unitsPerServing: number): PerUnitNutrition {
  const per = (v: number) => Math.round((v / unitsPerServing) * 10) / 10;
  return {
    caloriesPerUnit: Math.round(scan.calories / unitsPerServing),
    protein: per(scan.protein),
    carbs: per(scan.carbs),
    fat: per(scan.fat),
  };
}

/** A believable label so the flow can be tried without an API key. */
export async function demoNutritionScan(): Promise<ScannedNutrition> {
  await new Promise((r) => setTimeout(r, 900));
  return {
    foodName: "Greek Yogurt, plain nonfat",
    servingSize: 0.75,
    servingUnit: "cup",
    servingsPerContainer: 4,
    calories: 100,
    protein: 18,
    carbs: 6,
    fat: 0,
  };
}
