/**
 * Stop position queries used by `scripts/generate-stops-positions.ts` and re-exported
 * from `selectFromDatabase.ts`. Kept separate so the CLI does not load `cacheHelper`
 * (which imports React `cache` and breaks under plain Node/tsx).
 */

import { routes } from "@shared/db/schema/routes";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import { trips } from "@shared/db/schema/trips";
import { and, between, eq, exists, sql } from "drizzle-orm";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { isStopIdExcludedFromClient } from "@/app/utilities/stopIdRules";
import {
	getDefaultOperator,
	resolveOperator,
} from "@/shared/config/gtfsOperators";
import { getDb } from "./db";

const db = getDb();

const latestFeedVersionByOperator = (operator: string) =>
	sql`(SELECT MAX(${trips.feed_version}) FROM trips WHERE ${trips.operator} = ${operator})`;

function dedupeStopPositionRows(
	data: {
		stop_id: string | null;
		stop_lat: number | null;
		stop_lon: number | null;
	}[],
): { id: string; lat: number; lon: number }[] {
	const seen = new Set<string>();
	const out: { id: string; lat: number; lon: number }[] = [];
	for (const row of data) {
		const sid = row.stop_id;
		if (!sid || seen.has(sid) || isStopIdExcludedFromClient(sid)) continue;
		seen.add(sid);
		if (row.stop_lat == null || row.stop_lon == null) continue;
		out.push({
			id: sid,
			lat: Number(row.stop_lat),
			lon: Number(row.stop_lon),
		});
	}
	return out;
}

async function selectStopPositionsFromDatabaseWithWhere(
	whereExtra: ReturnType<typeof and> | undefined,
	operatorInput = getDefaultOperator(),
): Promise<{ id: string; lat: number; lon: number }[]> {
	const operator = resolveOperator(operatorInput);
	const latestFeedVersion = latestFeedVersionByOperator(operator);
	MetricsTracker.trackDbQuery();
	const baseWhere = and(
		eq(stops.feed_version, latestFeedVersion),
		eq(stops.operator, operator),
	);
	const whereClause =
		whereExtra === undefined ? baseWhere : and(baseWhere, whereExtra);

	/** Semi-join: planner can filter `stops` first (bbox + index), then probe stop_times/trips/routes. */
	const hasServingTrip = exists(
		db
			.select({ _: sql`1` })
			.from(stop_times)
			.innerJoin(
				trips,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.operator, stop_times.operator),
					eq(trips.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(routes.route_id, trips.route_id),
					eq(routes.operator, trips.operator),
					eq(routes.feed_version, latestFeedVersion),
				),
			)
			.where(
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
					eq(stop_times.feed_version, latestFeedVersion),
				),
			),
	);

	const data = await db
		.select({
			stop_id: stops.stop_id,
			stop_lat: stops.stop_lat,
			stop_lon: stops.stop_lon,
		})
		.from(stops)
		.where(and(whereClause, hasServingTrip));

	return dedupeStopPositionRows(data);
}

export const selectAllStopPositionsFromDatabase = async (
	operatorInput = getDefaultOperator(),
): Promise<
	{ id: string; lat: number; lon: number }[]
> => {
	try {
		return await selectStopPositionsFromDatabaseWithWhere(
			undefined,
			operatorInput,
		);
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** Same as selectAll but only stops inside the bounding box (uses idx_stops_feed_lat_lon). */
export const selectStopPositionsInBoundsFromDatabase = async (bounds: {
	north: number;
	south: number;
	east: number;
	west: number;
}, operatorInput = getDefaultOperator()): Promise<{ id: string; lat: number; lon: number }[]> => {
	const { north, south, east, west } = bounds;
	try {
		return await selectStopPositionsFromDatabaseWithWhere(
			and(
				between(stops.stop_lat, south, north),
				between(stops.stop_lon, west, east),
			),
			operatorInput,
		);
	} catch (error) {
		console.log(error);
		return [];
	}
};

export const selectLatestFeedVersionFromDatabase = async (
	operatorInput = getDefaultOperator(),
): Promise<
	string | null
> => {
	const operator = resolveOperator(operatorInput);
	try {
		const [filtered] = await db
			.select({ v: sql<string>`MAX(${trips.feed_version})::text` })
			.from(trips)
			.where(eq(trips.operator, operator));
		return filtered?.v ?? null;
	} catch (error) {
		console.log(error);
		return null;
	}
};
