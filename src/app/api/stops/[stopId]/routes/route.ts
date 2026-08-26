import { type NextRequest, NextResponse } from "next/server";
import {
	resolveStopBoardStopIdsFromDatabase,
	selectRoutesForStopFromDatabase,
	selectStopMetaFromDatabase,
} from "@/app/services/dataProcessors/selectFromDatabase";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 120;

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ stopId: string }> },
) {
	const operator = resolveOperator(
		request.nextUrl.searchParams.get("operator"),
	);
	const { stopId: rawStopId } = await context.params;
	const stopId = decodeURIComponent(rawStopId);

	if (!stopId.trim()) {
		return NextResponse.json({ error: "Missing stopId" }, { status: 400 });
	}

	try {
		const { stationStopId } = await resolveStopBoardStopIdsFromDatabase(
			stopId,
			operator,
		);
		const normalizedStopId = stationStopId || stopId;
		const [meta, routes] = await Promise.all([
			selectStopMetaFromDatabase(normalizedStopId, operator),
			selectRoutesForStopFromDatabase(normalizedStopId, operator),
		]);

		if (!meta) {
			return NextResponse.json({ error: "Stop not found" }, { status: 404 });
		}

		return NextResponse.json(
			{
				stop_id: meta.stop_id,
				stationStopId: normalizedStopId,
				stop_name: meta.stop_name,
				platform_code: meta.platform_code,
				stop_lat: meta.stop_lat,
				stop_lon: meta.stop_lon,
				feed_version: meta.feed_version,
				routes,
			},
			{
				headers: {
					"Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching stop routes:", error);
		return NextResponse.json(
			{ error: "Failed to fetch stop routes" },
			{ status: 500 },
		);
	}
}
