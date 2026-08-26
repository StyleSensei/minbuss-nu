import { type NextRequest, NextResponse } from "next/server";
import {
	getCachedStopDepartures,
	getCachedTripUpdates,
	getCachedVehiclePositions,
} from "@/app/services/cacheHelper";
import {
	selectStopBoardChildrenFromDatabase,
	selectStopMetaFromDatabase,
} from "@/app/services/dataProcessors/selectFromDatabase";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const dynamic = "force-dynamic";

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ stopId: string }> },
) {
	const operator = resolveOperator(
		request.nextUrl.searchParams.get("operator"),
	);
	const { stopId: rawStopId } = await context.params;
	const stopId = decodeURIComponent(rawStopId).trim();
	if (!stopId) {
		return NextResponse.json({ error: "Missing stopId" }, { status: 400 });
	}

	try {
		const schedule = await getCachedStopDepartures(stopId, operator);
		const tripIds = new Set(
			schedule.departures.map((row) => row.trip_id).filter(Boolean),
		);
		const stationStopId = schedule.stationStopId || stopId;
		const [stop, children, allTripUpdates, vehicleResult] = await Promise.all([
			selectStopMetaFromDatabase(stationStopId, operator),
			selectStopBoardChildrenFromDatabase(
				schedule.stationStopIds.length
					? schedule.stationStopIds
					: [stationStopId],
				operator,
			),
			getCachedTripUpdates(operator),
			getCachedVehiclePositions(operator),
		]);

		if (!stop) {
			return NextResponse.json({ error: "Stop not found" }, { status: 404 });
		}

		const tripUpdates = allTripUpdates.filter((update) => {
			const tripId = update.trip.tripId;
			return Boolean(tripId && tripIds.has(tripId));
		});
		const vehicles = vehicleResult.data.filter((vehicle) => {
			const tripId = vehicle.trip?.tripId;
			return Boolean(tripId && tripIds.has(tripId));
		});
		const activeTripIds = [
			...new Set(
				vehicles
					.map((vehicle) => vehicle.trip?.tripId)
					.filter((tripId): tripId is string => Boolean(tripId)),
			),
		];
		const routes = [
			...new Set(
				schedule.departures
					.map((departure) => departure.route_short_name)
					.filter(Boolean),
			),
		];

		return NextResponse.json(
			{
				stop,
				stationStopId,
				stationStopIds: schedule.stationStopIds,
				children,
				routes,
				departures: schedule.departures,
				tripUpdates,
				activeTripIds,
				vehicles,
			},
			{
				headers: {
					"Cache-Control": "private, no-store",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching stop departures:", error);
		return NextResponse.json(
			{ error: "Failed to fetch stop departures" },
			{ status: 500 },
		);
	}
}
