import { NextResponse, type NextRequest } from "next/server";
import {
	selectNearestStopsFromDatabase,
	selectRoutesForStopsFromDatabase,
} from "@/app/services/dataProcessors/selectFromDatabase";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 120;

export async function GET(request: NextRequest) {
	const t0 = Date.now();
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
		const nearestMs = Date.now() - t0;
		const routesByStopId = await selectRoutesForStopsFromDatabase(
			stops.map((s) => s.stop_id),
			operator,
		);
		const routesMs = Date.now() - t0 - nearestMs;
		const stopsWithRoutes = stops.map((s) => ({
			...s,
			routes: routesByStopId[s.stop_id] ?? [],
		}));
		const durationMs = Date.now() - t0;

		return NextResponse.json(
			{ stops: stopsWithRoutes },
			{
				headers: {
					"Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
					"x-handler-duration-ms": String(durationMs),
					"x-db-nearest-ms": String(nearestMs),
					"x-db-routes-ms": String(routesMs),
					"x-server-uptime-ms": String(Math.floor(process.uptime() * 1000)),
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
