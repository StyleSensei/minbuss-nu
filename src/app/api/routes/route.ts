import { NextResponse } from "next/server";
import { selectAllroutesForLatestFeed } from "@/app/services/dataProcessors/selectAllRoutes";

/** Tidsbaserad cache; töms vid lyckad GTFS-cron via POST /api/revalidate-feed. */
export const revalidate = 2592000; // 30 days

export async function GET() {
	const data = await selectAllroutesForLatestFeed();
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
