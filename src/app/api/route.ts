import { NextResponse } from "next/server";
import { selectAllroutesForLatestFeed } from "@/app/services/dataProcessors/selectAllRoutes";

/** Tidsbaserad cache; töms vid lyckad GTFS-cron via POST /api/revalidate-feed. */
export const revalidate = 2592000; // 30 days

export async function GET() {
	const routes = await selectAllroutesForLatestFeed();
	return NextResponse.json(
		{ routes },
		{
			headers: {
				"Cache-Control":
					"public, s-maxage=2592000, stale-while-revalidate=604800",
			},
		},
	);
}
