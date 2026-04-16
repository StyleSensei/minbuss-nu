import { NextResponse } from "next/server";
import type { ITripData } from "@/app/context/DataContext";
import {
	getCachedDbData,
	getCachedVehiclePositions,
} from "@/app/services/cacheHelper";

export const revalidate = 2;
export const preferredRegion = "arn1";

export async function GET(
	_request: Request,
	context: { params: Promise<{ busline: string }> },
) {
	const { busline } = await context.params;

	if (!busline) {
		return NextResponse.json(
			{ error: { type: "OTHER", message: "Missing busline parameter" } },
			{ status: 400 },
		);
	}

	try {
		const cachedVehiclePositions = await getCachedVehiclePositions();

		const activeTrips = new Set(
			cachedVehiclePositions.data
				.filter((vehicle) => vehicle?.trip?.tripId)
				.map((vehicle) => vehicle.trip.tripId),
		);

		if (activeTrips.size === 0) {
			return NextResponse.json(
				{ data: [], error: cachedVehiclePositions.error },
				{
					headers: {
						"Cache-Control": "public, s-maxage=2, stale-while-revalidate=5",
					},
				},
			);
		}

		const cachedDbData = (await getCachedDbData(busline)) as ITripData;
		const tripById = new Map(
			cachedDbData.currentTrips
				.filter((trip) => trip?.trip_id)
				.map((trip) => [trip.trip_id, trip] as const),
		);

		const filteredData = cachedVehiclePositions.data.filter((vehicle) => {
			if (!vehicle?.trip?.tripId) return false;
			return tripById.has(vehicle.trip.tripId);
		});

		return NextResponse.json(
			{ data: filteredData, error: cachedVehiclePositions.error },
			{
				headers: {
					"Cache-Control": "public, s-maxage=2, stale-while-revalidate=5",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching vehicles:", error);
		return NextResponse.json(
			{
				data: [],
				error: {
					type: "OTHER",
					message: "Ett fel uppstod vid hämtning av fordonsdata",
				},
			},
			{ status: 500 },
		);
	}
}
