import { type NextRequest, NextResponse } from "next/server";
import {
	selectLatestFeedVersionFromDatabase,
	selectStopPositionsInBoundsFromDatabase,
} from "@/app/services/dataProcessors/stopPositionsStaticQueries";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const dynamic = "force-dynamic";
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

/** Reject huge boxes that defeat the bbox index and risk function timeouts. */
const MAX_BBOX_LAT_SPAN = 0.35;
const MAX_BBOX_LON_SPAN = 0.5;

/**
 * Viewport stop markers. Requires north/south/east/west — unbounded scans
 * (`selectAllStopPositionsFromDatabase`) are reserved for offline generation scripts.
 */
export async function GET(request: NextRequest) {
	const t0 = Date.now();
	try {
		const bbox = parseBounds(request.nextUrl.searchParams);
		if (!bbox) {
			return NextResponse.json(
				{
					error:
						"Missing or invalid bounds. Pass north, south, east, west query params.",
				},
				{ status: 400 },
			);
		}
		if (
			bbox.north - bbox.south > MAX_BBOX_LAT_SPAN ||
			bbox.east - bbox.west > MAX_BBOX_LON_SPAN
		) {
			return NextResponse.json(
				{ error: "Bounds too large; zoom in and retry." },
				{ status: 400 },
			);
		}

		const operator = resolveOperator(
			request.nextUrl.searchParams.get("operator"),
		);

		const [stops, v] = await Promise.all([
			selectStopPositionsInBoundsFromDatabase(bbox, operator),
			selectLatestFeedVersionFromDatabase(operator),
		]);

		const durationMs = Date.now() - t0;
		const cacheControl =
			stops.length > 0
				? "public, s-maxage=86400, stale-while-revalidate=604800"
				: "public, s-maxage=60, stale-while-revalidate=300";
		return NextResponse.json(
			{ v: v ?? "0", stops },
			{
				headers: {
					"Cache-Control": cacheControl,
					"x-handler-duration-ms": String(durationMs),
					"x-server-uptime-ms": String(Math.floor(process.uptime() * 1000)),
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
