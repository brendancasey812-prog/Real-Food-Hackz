import Anthropic from "@anthropic-ai/sdk";
import { ReceiptError } from "./receipt";

export const MODEL = "claude-opus-5";

/** Set by next.config on builds that ship API routes (a server host, not GitHub Pages). */
export const SERVER_AI = process.env.NEXT_PUBLIC_SERVER_AI === "1";

/**
 * Ask Claude something, by whichever route this build has.
 *
 * Two routes, in order of preference. A build with API routes proxies through
 * the server, so the key is an environment variable the browser never sees.
 * The static build on GitHub Pages has no server at all, so it falls back to a
 * key the user pasted into the app — theirs, kept in their own browser, billed
 * to them. That is the only way an entirely static site can call an API, and
 * it is why the key box sits next to the button that spends it.
 */
export async function askClaude(
  { system, text, apiKey }: { system: string; text: string; apiKey: string },
): Promise<string> {
  if (SERVER_AI) {
    try {
      const resp = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, text }),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (typeof data.text === "string") return data.text;
      }
      // 404/501 means this build has no proxy; anything else, fall through to
      // the user's own key rather than failing on a route that may be absent.
    } catch {
      /* offline or no route — try the client key */
    }
  }

  if (!apiKey.trim()) {
    throw new ReceiptError(
      "Add your Anthropic API key below and try again — this build has no server to keep one for you.",
    );
  }

  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: text }],
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) throw new ReceiptError("That API key was rejected. Check it below.");
    if (err.status === 429) throw new ReceiptError("Rate limited. Wait a moment and try again.");
    throw new ReceiptError(err.message || "Couldn't reach the API. Check your connection and key.");
  }

  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new ReceiptError("Claude sent nothing back. Try again.");
  return block.text;
}

/** Pull the JSON out of a reply that may be fenced or padded with prose. */
export function jsonFrom(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : reply).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new ReceiptError("Claude's answer wasn't readable. Try again.");
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new ReceiptError("Claude's answer wasn't readable. Try again.");
  }
}
