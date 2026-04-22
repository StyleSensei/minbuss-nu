import { NextResponse, type NextRequest } from "next/server";
import {
	searchStopsByNameFromDatabase,
	selectRoutesForStopsFromDatabase,
} from "@/app/services/dataProcessors/selectFromDatabase";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 120;

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const q = searchParams.get("q") ?? "";
	const operator = resolveOperator(searchParams.get("operator"));
	const limit = Math.min(
		Math.max(Number(searchParams.get("limit")) || 20, 1),
		50,
	);

	if (!q.trim()) {
		return NextResponse.json({ stops: [] });
	}

	try {
		const stops = await searchStopsByNameFromDatabase(q, limit, operator);
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
		console.error("Error searching stops:", error);
		return NextResponse.json(
			{ error: "Failed to search stops" },
			{ status: 500 },
		);
	}
}
