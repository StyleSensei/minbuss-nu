import { NextResponse, type NextRequest } from "next/server";
import { getCachedTripStops } from "@/app/services/cacheHelper";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 300;

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ tripId: string }> },
) {
	const { tripId: rawTripId } = await context.params;
	const tripId = decodeURIComponent(rawTripId).trim();

	if (!tripId) {
		return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
	}

	const operator = resolveOperator(request.nextUrl.searchParams.get("operator"));

	try {
		const stops = await getCachedTripStops(tripId, operator);
		return NextResponse.json(
			{ stops },
			{
				headers: {
					"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching trip stops:", error);
		return NextResponse.json(
			{ error: "Failed to fetch trip stops" },
			{ status: 500 },
		);
	}
}
