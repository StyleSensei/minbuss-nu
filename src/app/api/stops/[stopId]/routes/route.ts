import { NextResponse, type NextRequest } from "next/server";
import {
	selectRoutesForStopFromDatabase,
	selectStopMetaFromDatabase,
} from "@/app/services/dataProcessors/selectFromDatabase";
import { isStopIdExcludedFromClient } from "@/app/utilities/stopIdRules";

export const revalidate = 120;

export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ stopId: string }> },
) {
	const { stopId: rawStopId } = await context.params;
	const stopId = decodeURIComponent(rawStopId);

	if (!stopId.trim()) {
		return NextResponse.json({ error: "Missing stopId" }, { status: 400 });
	}

	if (isStopIdExcludedFromClient(stopId)) {
		return NextResponse.json(
			{ error: "Stop id not supported" },
			{ status: 400 },
		);
	}

	try {
		const [meta, routes] = await Promise.all([
			selectStopMetaFromDatabase(stopId),
			selectRoutesForStopFromDatabase(stopId),
		]);

		if (!meta) {
			return NextResponse.json({ error: "Stop not found" }, { status: 404 });
		}

		return NextResponse.json(
			{
				stop_id: meta.stop_id,
				stop_name: meta.stop_name,
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
