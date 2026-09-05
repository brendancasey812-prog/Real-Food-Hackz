import { credentials } from "../_client";

/** Whether this deployment can talk to Kroger at all. Never leaks the secret. */
export function GET() {
  return Response.json({ configured: credentials() !== null });
}
