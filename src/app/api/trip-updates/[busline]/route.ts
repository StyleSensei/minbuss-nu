import { type NextRequest, NextResponse } from "next/server";
import {
	getCachedDbData,
	getCachedTripUpdates,
} from "@/app/services/cacheHelper";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 20;
export const preferredRegion = "arn1";

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ busline: string }> },
) {
	const { busline } = await context.params;
	const operator = resolveOperator(request.nextUrl.searchParams.get("operator"));

	if (!busline) {
		return NextResponse.json(
			{ error: "Missing busline parameter" },
			{ status: 400 },
		);
	}

	try {
		const cachedTripUpdates = await getCachedTripUpdates(operator);
		const cachedDbData = await getCachedDbData(busline, undefined, operator);
		const tripIdsForLine = new Set(
			cachedDbData.currentTrips
				.map((trip) => trip?.trip_id)
				.filter((id): id is string => Boolean(id)),
		);
		const filteredData = cachedTripUpdates.filter((u) =>
			tripIdsForLine.has(u?.trip?.tripId ?? ""),
		);

		return NextResponse.json(
			{ data: filteredData },
			{
				headers: {
					"Cache-Control": "public, s-maxage=20, stale-while-revalidate=30",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching trip updates:", error);
		return NextResponse.json(
			{ error: "Failed to fetch trip updates" },
			{ status: 500 },
		);
	}
}
