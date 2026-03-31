import { NextResponse } from "next/server";
import {
	selectAllStopPositionsFromDatabase,
	selectLatestFeedVersionFromDatabase,
} from "@/app/services/dataProcessors/stopPositionsStaticQueries";

export const revalidate = 3600;

/**
 * Same shape as public/stops-positions.json — used when the static file is empty
 * (e.g. fresh clone) so the map can still load stop positions (cached at the edge).
 */
export async function GET() {
	try {
		const [stops, v] = await Promise.all([
			selectAllStopPositionsFromDatabase(),
			selectLatestFeedVersionFromDatabase(),
		]);

		return NextResponse.json(
			{ v: v ?? "0", stops },
			{
				headers: {
					"Cache-Control":
						"public, s-maxage=86400, stale-while-revalidate=604800",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching stop positions:", error);
		return NextResponse.json(
			{ error: "Failed to fetch stop positions" },
			{ status: 500 },
		);
	}
}
