import { NextResponse } from "next/server";
import { selectAllroutesForLatestFeed } from "@/app/services/dataProcessors/selectAllRoutes";
import { resolveOperator } from "@/shared/config/gtfsOperators";

/** Tidsbaserad cache; töms vid lyckad GTFS-cron via POST /api/revalidate-feed. */
export const revalidate = 2592000; // 30 days

export async function GET(request: Request) {
	const operator = resolveOperator(new URL(request.url).searchParams.get("operator"));
	const data = await selectAllroutesForLatestFeed(operator);
	const routesArray = data
		.map((route) => route.line)
		.filter((route): route is string => route !== null);

	const routesObject: Record<string, boolean> = {};
	for (const route of routesArray) {
		routesObject[route] = true;
	}

	return NextResponse.json(
		{ asObject: routesObject, asArray: routesArray },
		{
			headers: {
				"Cache-Control":
					"public, s-maxage=2592000, stale-while-revalidate=604800",
			},
		},
	);
}
