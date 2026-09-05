// The server half of the Kroger integration: the only place the client secret
// is ever read, and the only place that talks to Kroger directly.
//
// These routes exist in the server build (Vercel, local dev) and are removed
// from the GitHub Pages build, which is why the client asks /status first
// rather than assuming.

const TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";
const API = "https://api.kroger.com/v1";

interface Token {
  value: string;
  /** Epoch ms. */
  expiresAt: number;
}

let cached: Token | null = null;

export function credentials(): { id: string; secret: string } | null {
  const id = process.env.KROGER_CLIENT_ID;
  const secret = process.env.KROGER_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

/**
 * A client_credentials token, reused until a minute before it expires.
 * Kroger's tokens last 30 minutes and the rate limit is per app, so minting a
 * new one per request would be the fastest way to run out of them.
 */
async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const creds = credentials();
  if (!creds) throw new Error("Kroger credentials are not set on this deployment.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });

  if (!res.ok) {
    throw new Error(`Kroger rejected the credentials (${res.status}).`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000,
  };
  return cached.value;
}

/** A GET against Kroger's API with a live token attached. */
export async function krogerGet(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Kroger API error (${res.status}) on ${path.split("?")[0]}`);
  }
  return res.json();
}

/** One shape for every failure, so the client can always render something. */
export function fail(e: unknown, status = 502) {
  const message = e instanceof Error ? e.message : "Kroger request failed.";
  return Response.json({ error: message }, { status });
}
