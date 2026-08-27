/**
 * Stop position queries used by `scripts/generate-stops-positions.ts` and re-exported
 * from `selectFromDatabase.ts`. Kept separate so the CLI does not load `cacheHelper`
 * (which imports React `cache` and breaks under plain Node/tsx).
 */

import { routes } from "@shared/db/schema/routes";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import { trips } from "@shared/db/schema/trips";
import { and, between, eq, exists, or, sql } from "drizzle-orm";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import {
	getDefaultOperator,
	resolveOperator,
} from "@/shared/config/gtfsOperators";
import { getDb } from "./db";
import { latestFeedVersionsByOperator } from "./latestFeedVersions";

const db = getDb();

export type StopPositionRow = {
	id: string;
	lat: number;
	lon: number;
	name: string;
	isParent: boolean;
	locationType: number;
	platformCode?: string;
	parent?: string;
};

function dedupeStopPositionRows(
	data: {
		stop_id: string | null;
		stop_name: string | null;
		stop_lat: number | null;
		stop_lon: number | null;
		location_type: number | null;
		parent_station: string | null;
		platform_code: string | null;
	}[],
): StopPositionRow[] {
	const seen = new Set<string>();
	const out: StopPositionRow[] = [];
	for (const row of data) {
		const sid = row.stop_id;
		if (!sid || seen.has(sid)) continue;
		seen.add(sid);
		if (row.stop_lat == null || row.stop_lon == null) continue;
		const locationType = Number(row.location_type);
		const isParent = locationType === 1;
		const parent = row.parent_station?.trim() || undefined;
		const rawPlatformCode = row.platform_code?.trim();
		const platformCode =
			rawPlatformCode && !/^OLD\d*$/i.test(rawPlatformCode)
				? rawPlatformCode
				: undefined;
		out.push({
			id: sid,
			lat: Number(row.stop_lat),
			lon: Number(row.stop_lon),
			name: row.stop_name?.trim() || sid,
			isParent,
			locationType,
			...(platformCode ? { platformCode } : {}),
			...(parent && !isParent ? { parent } : {}),
		});
	}
	return out;
}

async function selectStopPositionsFromDatabaseWithWhere(
	whereExtra: ReturnType<typeof and> | undefined,
	operatorInput = getDefaultOperator(),
): Promise<StopPositionRow[]> {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	const baseWhere = and(
		eq(stops.feed_version, feed.stops),
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
					eq(trips.feed_version, feed.trips),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(routes.route_id, trips.route_id),
					eq(routes.operator, trips.operator),
					eq(routes.feed_version, feed.routes),
				),
			)
			.where(
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
					eq(stop_times.feed_version, feed.stopTimes),
				),
			),
	);

	const stopSelect = {
		stop_id: stops.stop_id,
		stop_name: stops.stop_name,
		stop_lat: stops.stop_lat,
		stop_lon: stops.stop_lon,
		location_type: stops.location_type,
		parent_station: stops.parent_station,
		platform_code: stops.platform_code,
	};

	/**
	 * Split parents/entrances from served platforms.
	 * A single `OR (location_type IN (1,2) OR EXISTS(...))` prevents Postgres from
	 * using the bbox index and can hang `/api/stops/positions` under load.
	 */
	const [stationRows, servedRows] = await Promise.all([
		db
			.select(stopSelect)
			.from(stops)
			.where(
				and(
					whereClause,
					or(eq(stops.location_type, 1), eq(stops.location_type, 2)),
				),
			),
		db
			.select(stopSelect)
			.from(stops)
			.where(and(whereClause, hasServingTrip)),
	]);

	return dedupeStopPositionRows([...stationRows, ...servedRows]);
}

export const selectAllStopPositionsFromDatabase = async (
	operatorInput = getDefaultOperator(),
): Promise<StopPositionRow[]> => {
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
export const selectStopPositionsInBoundsFromDatabase = async (
	bounds: {
		north: number;
		south: number;
		east: number;
		west: number;
	},
	operatorInput = getDefaultOperator(),
): Promise<StopPositionRow[]> => {
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
): Promise<string | null> => {
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
