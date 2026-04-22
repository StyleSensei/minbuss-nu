import { NextResponse, type NextRequest } from "next/server";
import {
	selectNearestStopsFromDatabase,
	selectRoutesForStopsFromDatabase,
} from "@/app/services/dataProcessors/selectFromDatabase";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 120;

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const lat = Number(searchParams.get("lat"));
	const lng = Number(searchParams.get("lng"));
	const operator = resolveOperator(searchParams.get("operator"));
	const limit = Math.min(
		Math.max(Number(searchParams.get("limit")) || 10, 1),
		20,
	);

	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		return NextResponse.json(
			{ error: "Missing or invalid lat/lng" },
			{ status: 400 },
		);
	}

	try {
		const stops = await selectNearestStopsFromDatabase(lat, lng, limit, operator);
		const routesByStopId = await selectRoutesForStopsFromDatabase(
			stops.map((s) => s.stop_id),
			operator,
		);
		const stopsWithRoutes = stops.map((s) => ({
			...s,
			routes: routesByStopId[s.stop_id] ?? [],
		}));

		return NextResponse.json(
			{ stops: stopsWithRoutes },
			{
				headers: {
					"Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching nearby stops:", error);
		return NextResponse.json(
			{ error: "Failed to fetch nearby stops" },
			{ status: 500 },
		);
	}
}
