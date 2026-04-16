import { type NextRequest, NextResponse } from "next/server";
import {
	getCachedDbData,
	getCachedTripUpdates,
} from "@/app/services/cacheHelper";

export const revalidate = 20;
export const preferredRegion = "arn1";

export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ busline: string }> },
) {
	const { busline } = await context.params;

	if (!busline) {
		return NextResponse.json(
			{ error: "Missing busline parameter" },
			{ status: 400 },
		);
	}

	try {
		const cachedTripUpdates = await getCachedTripUpdates();
		const cachedDbData = await getCachedDbData(busline);
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
