import { NextResponse } from "next/server";
import { selectAllroutesForLatestFeed } from "@/app/services/dataProcessors/selectAllRoutes";
import { resolveOperator } from "@/shared/config/gtfsOperators";

/** Tidsbaserad cache; töms vid lyckad GTFS-cron via POST /api/revalidate-feed. */
export const revalidate = 2592000; // 30 days

export async function GET(request: Request) {
	const operator = resolveOperator(new URL(request.url).searchParams.get("operator"));
	const routes = await selectAllroutesForLatestFeed(operator);
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
