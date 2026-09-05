import { krogerGet, fail } from "../_client";

/** Current price and pack size for one ingredient at one store. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const term = q.get("term")?.trim() ?? "";
  const locationId = q.get("locationId")?.trim() ?? "";
  if (!term || !locationId) {
    return Response.json({ error: "Both term and locationId are required." }, { status: 400 });
  }
  try {
    return Response.json(
      await krogerGet(
        `/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${encodeURIComponent(locationId)}&filter.limit=5`,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
