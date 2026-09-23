// Shared plumbing every AI-scan feature uses: one Claude call (the server
// proxy first, the user's own browser key as fallback) and one JSON parser
// tolerant of the markdown fences and stray prose a vision model sometimes
// wraps its answer in. Receipts, recipes and nutrition labels each have their
// own prompt and response shape, but none of them needs its own copy of "how
// do I actually reach Claude and turn the reply into JSON."

import Anthropic from "@anthropic-ai/sdk";

/** Set by next.config on builds that ship API routes (Vercel, not GitHub Pages). */
export const SERVER_AI = process.env.NEXT_PUBLIC_SERVER_AI === "1";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 4096;

export class ReceiptError extends Error {}

export type ImagePart = {
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
};

/**
 * Try the server-side proxy first so the API key never touches the browser.
 * Returns null when this build has no proxy, or the server has no key set —
 * the caller then falls back to the user's own key.
 */
async function viaServer(system: string, text: string, image?: ImagePart): Promise<string | null> {
  if (!SERVER_AI) return null;
  let resp: Response;
  try {
    resp = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, text, image })
    });
  } catch {
    return null; // offline or route missing — fall back to the client key
  }
  if (resp.status === 501 || resp.status === 404) return null;
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ReceiptError(data.error ?? "The AI service failed. Try again.");
  return typeof data.text === "string" ? data.text : null;
}

/** Call Claude directly from the browser with the user's own key. */
async function viaBrowser(apiKey: string, system: string, text: string, image?: ImagePart): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [
        {
          role: "user",
          content: image
            ? [
                { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
                { type: "text", text },
              ]
            : text
        },
      ]
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) throw new ReceiptError("Your Anthropic API key was rejected. Check it in Settings.");
    if (err.status === 429) throw new ReceiptError("Rate limited by the API. Wait a moment and try again.");
    throw new ReceiptError(err.message || "Couldn't reach the API. Check your connection and key.");
  }
  if (resp.stop_reason === "refusal") {
    throw new ReceiptError("That input couldn't be processed. Try a clearer photo or a different description.");
  }
  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new ReceiptError("The model returned no text. Try again.");
  }
  return block.text;
}

/**
 * Ask Claude to do one text/JSON-returning task: the server proxy first (any
 * deployed key — the browser never sees it), then the user's own key. Every
 * scan feature — receipt, recipe, nutrition label — is a system prompt and a
 * response-shape check layered on top of this one call.
 */
export async function askClaude(
  apiKey: string,
  system: string,
  text: string,
  image?: ImagePart,
  noKeyMessage = "Add your Anthropic API key in Settings to use this feature.",
): Promise<string> {
  const served = await viaServer(system, text, image);
  if (served != null) return served;
  if (!apiKey) throw new ReceiptError(noKeyMessage);
  return viaBrowser(apiKey, system, text, image);
}

/**
 * Strip a ```json fence and parse. Falls back to pulling the first {...}
 * block out of surrounding prose, since a vision model occasionally adds a
 * sentence before or after the JSON despite being told not to. Throws
 * `ReceiptError(onFailure)` — never a raw `SyntaxError` — so every caller's
 * catch block sees the same kind of error regardless of what went wrong.
 */
export function parseJsonLoose(text: string, onFailure: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new ReceiptError(onFailure);
    try {
      return JSON.parse(match[0]);
    } catch {
      throw new ReceiptError(onFailure);
    }
  }
}
