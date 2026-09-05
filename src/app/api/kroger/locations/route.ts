import { krogerGet, fail } from "../_client";

/** Kroger-family stores near a zip code. */
export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip")?.trim() ?? "";
  if (!/^\d{5}$/.test(zip)) {
    return Response.json({ error: "Enter a 5-digit zip code." }, { status: 400 });
  }
  try {
    return Response.json(
      await krogerGet(`/locations?filter.zipCode.near=${zip}&filter.limit=10`),
    );
  } catch (e) {
    return fail(e);
  }
}
