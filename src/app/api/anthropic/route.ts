import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side proxy for recipe scanning / parsing.
 *
 * This keeps ANTHROPIC_API_KEY on the server: the browser posts the prompt
 * here, never the key. Only available on the Vercel deployment — the static
 * GitHub Pages build excludes this route (see .github/workflows/deploy.yml),
 * and the client falls back to the user's own key there.
 */

const MODEL = "claude-opus-5";
const MAX_TOKENS = 4096;

type ImagePart = { media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "The server has no Anthropic API key configured. Add your own key in Settings, or set ANTHROPIC_API_KEY in the deployment." },
      { status: 501 },
    );
  }

  let body: { system?: string; text?: string; image?: ImagePart };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const { system, text, image } = body;
  if (!system || !text) {
    return Response.json({ error: "Missing prompt." }, { status: 400 });
  }

  const content: Anthropic.MessageParam["content"] = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
        { type: "text", text },
      ]
    : text;

  try {
    const client = new Anthropic({ apiKey: key });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content }]
    });

    if (resp.stop_reason === "refusal") {
      return Response.json({ error: "That input couldn't be processed." }, { status: 422 });
    }
    const block = resp.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return Response.json({ error: "The model returned no text." }, { status: 502 });
    }
    return Response.json({ text: block.text });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const status = err.status === 401 || err.status === 429 ? err.status : 502;
    return Response.json(
      { error: err.message ?? "Couldn't reach the Anthropic API." },
      { status },
    );
  }
}
