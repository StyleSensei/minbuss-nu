import { type NextRequest, NextResponse } from "next/server";
import {
	selectAllStopPositionsFromDatabase,
	selectLatestFeedVersionFromDatabase,
	selectStopPositionsInBoundsFromDatabase,
} from "@/app/services/dataProcessors/stopPositionsStaticQueries";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 3600;
export const preferredRegion = "arn1";

function parseBounds(sp: URLSearchParams): {
	north: number;
	south: number;
	east: number;
	west: number;
} | null {
	const n = sp.get("north");
	const s = sp.get("south");
	const e = sp.get("east");
	const w = sp.get("west");
	if (n == null || s == null || e == null || w == null) {
		return null;
	}
	const north = Number(n);
	const south = Number(s);
	const east = Number(e);
	const west = Number(w);
	if (
		Number.isNaN(north) ||
		Number.isNaN(south) ||
		Number.isNaN(east) ||
		Number.isNaN(west) ||
		north <= south ||
		east <= west
	) {
		return null;
	}
	return { north, south, east, west };
}

/**
 * Same shape as public/stops-positions.json — used when the static file is empty
 * (e.g. fresh clone) so the map can still load stop positions (cached at the edge).
 *
 * Optional query: north, south, east, west — returns only stops inside the box (smaller payload).
 */
export async function GET(request: NextRequest) {
	try {
		const bbox = parseBounds(request.nextUrl.searchParams);
		const operator = resolveOperator(request.nextUrl.searchParams.get("operator"));

		const [stops, v] = bbox
			? await Promise.all([
					selectStopPositionsInBoundsFromDatabase(bbox, operator),
					selectLatestFeedVersionFromDatabase(operator),
				])
			: await Promise.all([
					selectAllStopPositionsFromDatabase(operator),
					selectLatestFeedVersionFromDatabase(operator),
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
