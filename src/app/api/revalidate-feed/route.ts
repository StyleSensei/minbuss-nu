import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { invalidateGtfsCaches } from "@/app/services/invalidateGtfsCaches";

/**
 * Tömmer Next-data-/ISR-cache för feed-beroende API:er efter lyckad GTFS-import.
 * Edge svarar därefter med nytt innehåll (s-maxage gäller mellan körningar).
 */
export async function POST(request: Request) {
	const expected = process.env.REVALIDATE_SECRET?.trim();
	if (!expected) {
		return NextResponse.json(
			{ error: "REVALIDATE_SECRET is not configured" },
			{ status: 503 },
		);
	}

	const auth = request.headers.get("authorization");
	const bearer = auth?.replace(/^Bearer\s+/i, "").trim();
	const token = bearer

	if (!token || token !== expected) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	revalidatePath("/api/routes");
	revalidatePath("/api");

	const cacheInvalidation = await invalidateGtfsCaches();

	return NextResponse.json({
		revalidated: true,
		paths: ["/api/routes", "/api"],
		cacheInvalidation,
	});
}
