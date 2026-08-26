import { routes } from "@shared/db/schema/routes";
import { selectAllSchema } from "@shared/db/schema/selectAll";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import { trips } from "@shared/db/schema/trips";
import type { IDbData } from "@shared/models/IDbData";
import type { IShapes } from "@shared/models/IShapes";
import type { IStopBoardChild } from "@shared/models/IStopBoardStation";
import {
	and,
	eq,
	exists,
	gte,
	inArray,
	isNotNull,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { getCachedVehiclePositions } from "@/app/services/cacheHelper";
import { createMinutesFilter } from "@/app/utilities/calculateTimeFilter";
import { getDistanceFromLatLon } from "@/app/utilities/getDistanceFromLatLon";
import { getGtfsDateTime } from "@/app/utilities/gtfsTimeContext";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { shouldExpandStopBoardToStation } from "@/app/utilities/stopBoardStopResolution";
import { isStopIdExcludedFromClient } from "@/app/utilities/stopIdRules";
import {
	getDefaultOperator,
	resolveOperator,
} from "@/shared/config/gtfsOperators";
import { calendarDates } from "@/shared/db/schema/calendar_dates";
import { shapes } from "@/shared/db/schema/shapes";
import { getDb } from "./db";
import { latestFeedVersionsByOperator } from "./latestFeedVersions";

const db = getDb();
const UPCOMING_TRIPS_HOURS_AHEAD = 12;
const UPCOMING_TRIPS_LIMIT = 1000;

function createUpcomingServiceWindowFilter(
	minutesFilter: SQL,
	dt: ReturnType<typeof getGtfsDateTime>,
	hoursAhead: number,
): SQL {
	const windowStart = dt.minus({ minutes: 15 });
	const windowEnd = dt.plus({ hours: hoursAhead });
	const serviceDays = [
		dt.minus({ days: 1 }).startOf("day"),
		dt.startOf("day"),
		dt.plus({ days: 1 }).startOf("day"),
	];
	const clauses = serviceDays.flatMap((serviceDay) => {
		const minMinutes = Math.max(
			0,
			Math.floor(windowStart.diff(serviceDay, "minutes").minutes),
		);
		const maxMinutes = Math.ceil(windowEnd.diff(serviceDay, "minutes").minutes);
		if (maxMinutes < minMinutes) return [];

		return [
			and(
				eq(calendarDates.date, new Date(serviceDay.toFormat("yyyy-MM-dd"))),
				gte(minutesFilter, minMinutes),
				lte(minutesFilter, maxMinutes),
			),
		];
	});

	return or(...clauses) ?? sql`false`;
}

export const selectCurrentTripsFromDatabase = async (
	busLine: string,
	operatorInput = getDefaultOperator(),
) => {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	const cachedVehiclePositions = await getCachedVehiclePositions(operator);
	const filteredTripIds = cachedVehiclePositions.data
		.map((vehicle) => vehicle?.trip?.tripId)
		.filter((tripId): tripId is string => typeof tripId === "string");

	try {
		const data = await db
			.select({
				operator: trips.operator,
				trip_id: trips.trip_id,
				shape_id: trips.shape_id,
				route_short_name: routes.route_short_name,
				stop_headsign: stop_times.stop_headsign,
				departure_time: stop_times.departure_time,
				stop_name: stops.stop_name,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				route_long_name: routes.route_long_name,
				route_type: routes.route_type,
				route_desc: routes.route_desc,
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.innerJoin(
				stop_times,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.operator, stop_times.operator),
				),
			)
			.innerJoin(
				stops,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
				),
			)
			.where(
				and(
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(stop_times.operator, operator),
					eq(stops.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					eq(stops.feed_version, feed.stops),
					eq(routes.route_short_name, busLine),
					inArray(trips.trip_id, filteredTripIds),
				),
			)
			.orderBy(trips.trip_id, stop_times.departure_time)
			.limit(1000);
		const parsed = z.array(selectAllSchema).parse(data) as IDbData[];

		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** Distinct stops served by the route (static GTFS), independent of realtime vehicles. */
export const selectDistinctStopsForLineFromDatabase = async (
	busLine: string,
	operatorInput = getDefaultOperator(),
): Promise<IDbData[]> => {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				operator: trips.operator,
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				route_short_name: routes.route_short_name,
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.innerJoin(
				stop_times,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.operator, stop_times.operator),
				),
			)
			.innerJoin(
				stops,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
				),
			)
			.where(
				and(
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(stop_times.operator, operator),
					eq(stops.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					eq(stops.feed_version, feed.stops),
					eq(routes.route_short_name, busLine),
				),
			)
			.groupBy(
				trips.operator,
				stops.stop_id,
				stops.stop_name,
				stops.stop_lat,
				stops.stop_lon,
				routes.route_short_name,
				trips.feed_version,
			);

		return data.map((row) => ({
			operator: row.operator ?? operator,
			trip_id: "",
			shape_id: "",
			stop_headsign: "",
			departure_time: "",
			stop_sequence: 0,
			stop_id: row.stop_id ?? "",
			stop_name: row.stop_name ?? "",
			stop_lat: Number(row.stop_lat),
			stop_lon: Number(row.stop_lon),
			route_short_name: row.route_short_name ?? "",
			feed_version: String(row.feed_version ?? ""),
		}));
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** Distinct shape IDs for the route (static GTFS), independent of realtime vehicles. */
export const selectDistinctShapeIdsForLineFromDatabase = async (
	busLine: string,
	operatorInput = getDefaultOperator(),
): Promise<string[]> => {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				shape_id: trips.shape_id,
			})
			.from(trips)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.where(
				and(
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(routes.route_short_name, busLine),
				),
			)
			.groupBy(trips.shape_id);

		return data
			.map((row) => row.shape_id)
			.filter((shapeId): shapeId is string => Boolean(shapeId));
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** Distinct route short names that serve a stop (static GTFS). */
export const selectRoutesForStopFromDatabase = async (
	stopId: string,
	operatorInput = getDefaultOperator(),
): Promise<string[]> => {
	if (!stopId.trim()) {
		return [];
	}
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	try {
		const { boardStopIds } = await resolveStopBoardStopIdsFromDatabase(
			stopId,
			operator,
		);
		if (boardStopIds.length === 0) return [];

		MetricsTracker.trackDbQuery();
		const data = await db
			.select({ route_short_name: routes.route_short_name })
			.from(stop_times)
			.innerJoin(
				trips,
				and(
					eq(stop_times.trip_id, trips.trip_id),
					eq(stop_times.operator, trips.operator),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.where(
				and(
					eq(stop_times.operator, operator),
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					inArray(stop_times.stop_id, boardStopIds),
				),
			)
			.groupBy(routes.route_short_name);

		const names = data
			.map((row) => row.route_short_name)
			.filter((n): n is string => Boolean(n));
		return [...new Set(names)].sort((a, b) => a.localeCompare(b, "sv"));
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** Distinct route short names for many stops in one query (latest feed). */
export const selectRoutesForStopsFromDatabase = async (
	stopIds: string[],
	operatorInput = getDefaultOperator(),
): Promise<Record<string, string[]>> => {
	const cleanedStopIds = [
		...new Set(stopIds.map((id) => id.trim()).filter(Boolean)),
	];
	if (cleanedStopIds.length === 0) {
		return {};
	}

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				stop_id: stop_times.stop_id,
				route_short_name: routes.route_short_name,
			})
			.from(stop_times)
			.innerJoin(
				trips,
				and(
					eq(stop_times.trip_id, trips.trip_id),
					eq(stop_times.operator, trips.operator),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.where(
				and(
					eq(stop_times.operator, operator),
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					inArray(stop_times.stop_id, cleanedStopIds),
				),
			)
			.groupBy(stop_times.stop_id, routes.route_short_name);

		const byStop = new Map<string, Set<string>>();
		for (const row of data) {
			if (!row.stop_id || !row.route_short_name) continue;
			const current = byStop.get(row.stop_id) ?? new Set<string>();
			current.add(row.route_short_name);
			byStop.set(row.stop_id, current);
		}

		const out: Record<string, string[]> = {};
		for (const stopId of cleanedStopIds) {
			const names = [...(byStop.get(stopId) ?? new Set<string>())];
			out[stopId] = names.sort((a, b) => a.localeCompare(b, "sv"));
		}
		return out;
	} catch (error) {
		console.log(error);
		return {};
	}
};

export {
	selectAllStopPositionsFromDatabase,
	selectLatestFeedVersionFromDatabase,
} from "./stopPositionsStaticQueries";

/** One stop’s meta for map preview / API (latest feed only). */
export const selectStopMetaFromDatabase = async (
	stopId: string,
	operatorInput = getDefaultOperator(),
): Promise<(INearbyStopRow & { feed_version: string }) | null> => {
	if (!stopId.trim()) {
		return null;
	}
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const [row] = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				location_type: stops.location_type,
				parent_station: stops.parent_station,
				platform_code: stops.platform_code,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				feed_version: stops.feed_version,
			})
			.from(stops)
			.where(
				and(
					eq(stops.feed_version, feed.stops),
					eq(stops.operator, operator),
					eq(stops.stop_id, stopId),
				),
			)
			.limit(1);
		if (!row?.stop_id || row.stop_lat == null || row.stop_lon == null) {
			return null;
		}
		return {
			stop_id: row.stop_id,
			stop_name: row.stop_name ?? "",
			location_type: row.location_type ?? 0,
			parent_station: row.parent_station?.trim() || null,
			platform_code: row.platform_code?.trim() || null,
			stop_lat: Number(row.stop_lat),
			stop_lon: Number(row.stop_lon),
			feed_version: String(row.feed_version ?? ""),
		};
	} catch (error) {
		console.log(error);
		return null;
	}
};

export interface INearbyStopRow {
	stop_id: string;
	stop_name: string;
	location_type?: number;
	parent_station?: string | null;
	platform_code?: string | null;
	stop_lat: number;
	stop_lon: number;
}

const NEARBY_BBOX_DEG = 0.05;
const NEARBY_CANDIDATE_CAP = 800;
const NEARBY_FALLBACK_CANDIDATE_CAP = 3000;

/**
 * Skåne: expandera bbox i steg — undvik `LIMIT` utan geografisk filter (kan kräva EXISTS för tusentals rader → timeout).
 * Loggar visade nearestMs >> routesMs (~4.4s vs ~0.1s).
 */
const NEARBY_SKANE_RINGS: readonly { halfDeg: number; cap: number }[] = [
	{ halfDeg: 0.018, cap: 140 },
	{ halfDeg: 0.035, cap: 260 },
	{ halfDeg: 0.055, cap: 400 },
	{ halfDeg: 0.09, cap: 520 },
];

/** Stops nearest to a point; bbox prefilter then Haversine sort. */
export const selectNearestStopsFromDatabase = async (
	lat: number,
	lng: number,
	limit = 10,
	operatorInput = getDefaultOperator(),
): Promise<INearbyStopRow[]> => {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		/** Semi-join (samma idé som stopPositionsStaticQueries): undvik JOIN+GROUP BY över enorma stop_times-rader. */
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

		const selectNearbyCandidates = async (
			bboxHalfDeg: number | null,
			candidateCap: number,
		) =>
			db
				.select({
					stop_id: stops.stop_id,
					stop_name: stops.stop_name,
					location_type: stops.location_type,
					parent_station: stops.parent_station,
					platform_code: stops.platform_code,
					stop_lat: stops.stop_lat,
					stop_lon: stops.stop_lon,
				})
				.from(stops)
				.where(
					and(
						eq(stops.feed_version, feed.stops),
						eq(stops.operator, operator),
						hasServingTrip,
						...(bboxHalfDeg != null
							? [
									gte(stops.stop_lat, lat - bboxHalfDeg),
									lte(stops.stop_lat, lat + bboxHalfDeg),
									gte(stops.stop_lon, lng - bboxHalfDeg),
									lte(stops.stop_lon, lng + bboxHalfDeg),
								]
							: []),
					),
				)
				.limit(candidateCap);

		let data: {
			stop_id: string | null;
			stop_name: string | null;
			location_type: number | null;
			parent_station: string | null;
			platform_code: string | null;
			stop_lat: unknown;
			stop_lon: unknown;
		}[];

		if (operator === "skane") {
			data = [];
			for (const ring of NEARBY_SKANE_RINGS) {
				data = await selectNearbyCandidates(ring.halfDeg, ring.cap);
				if (data.length > 0) break;
			}
		} else {
			data = await selectNearbyCandidates(
				NEARBY_BBOX_DEG,
				NEARBY_CANDIDATE_CAP,
			);
			if (data.length === 0) {
				data = await selectNearbyCandidates(
					null,
					NEARBY_FALLBACK_CANDIDATE_CAP,
				);
			}
		}

		const rows: INearbyStopRow[] = data
			.filter(
				(row) =>
					row.stop_id != null &&
					!isStopIdExcludedFromClient(row.stop_id) &&
					row.stop_name != null &&
					row.stop_lat != null &&
					row.stop_lon != null,
			)
			.map((row) => ({
				stop_id: row.stop_id as string,
				stop_name: row.stop_name as string,
				location_type: row.location_type ?? 0,
				parent_station: row.parent_station?.trim() || null,
				platform_code: row.platform_code?.trim() || null,
				stop_lat: Number(row.stop_lat),
				stop_lon: Number(row.stop_lon),
			}));

		const withDist = rows.map((r) => ({
			...r,
			dist: getDistanceFromLatLon(lat, lng, r.stop_lat, r.stop_lon),
		}));
		withDist.sort((a, b) => a.dist - b.dist);
		return withDist.slice(0, limit).map(({ dist: _d, ...r }) => r);
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** Text search on stop names (case-insensitive). */
export const searchStopsByNameFromDatabase = async (
	query: string,
	limit = 20,
	operatorInput = getDefaultOperator(),
): Promise<INearbyStopRow[]> => {
	const trimmed = query.trim().replace(/[%_]/g, "");
	if (trimmed.length < 2) {
		return [];
	}
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	const pattern = `%${trimmed}%`;
	try {
		const data = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				location_type: stops.location_type,
				parent_station: stops.parent_station,
				platform_code: stops.platform_code,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(stops)
			.innerJoin(
				stop_times,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
					eq(stop_times.feed_version, feed.stopTimes),
				),
			)
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
					eq(stops.feed_version, feed.stops),
					eq(stops.operator, operator),
					sql`lower(${stops.stop_name}) like lower(${pattern})`,
				),
			)
			.groupBy(
				stops.stop_id,
				stops.stop_name,
				stops.location_type,
				stops.parent_station,
				stops.platform_code,
				stops.stop_lat,
				stops.stop_lon,
			)
			.limit(limit);

		return data
			.filter(
				(row) =>
					row.stop_id != null &&
					!isStopIdExcludedFromClient(row.stop_id) &&
					row.stop_name != null &&
					row.stop_lat != null &&
					row.stop_lon != null,
			)
			.map((row) => ({
				stop_id: row.stop_id as string,
				stop_name: row.stop_name as string,
				location_type: row.location_type ?? 0,
				parent_station: row.parent_station?.trim() || null,
				platform_code: row.platform_code?.trim() || null,
				stop_lat: Number(row.stop_lat),
				stop_lon: Number(row.stop_lon),
			}));
	} catch (error) {
		console.log(error);
		return [];
	}
};

/** All stop_times for one trip (static GTFS), for schedule InfoWindow. */
export const selectTripStopsFromDatabase = async (
	tripId: string,
	operatorInput = getDefaultOperator(),
): Promise<IDbData[]> => {
	const trimmedTripId = tripId.trim();
	if (!trimmedTripId) {
		return [];
	}

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();

	try {
		const data = await db
			.select({
				operator: trips.operator,
				trip_id: trips.trip_id,
				shape_id: trips.shape_id,
				route_short_name: routes.route_short_name,
				stop_headsign: stop_times.stop_headsign,
				departure_time: stop_times.departure_time,
				stop_name: stops.stop_name,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				route_long_name: routes.route_long_name,
				route_type: routes.route_type,
				route_desc: routes.route_desc,
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.innerJoin(
				stop_times,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.operator, stop_times.operator),
				),
			)
			.innerJoin(
				stops,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
				),
			)
			.where(
				and(
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(stop_times.operator, operator),
					eq(stops.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					eq(stops.feed_version, feed.stops),
					eq(trips.trip_id, trimmedTripId),
				),
			)
			.orderBy(stop_times.stop_sequence)
			.limit(500);

		return z.array(selectAllSchema).parse(data) as IDbData[];
	} catch (error) {
		console.log(error);
		return [];
	}
};

export const selectUpcomingTripsFromDatabase = async (
	busLine: string,
	stop_name: string,
	operatorInput = getDefaultOperator(),
): Promise<IDbData[]> => {
	if (!stop_name.trim()) {
		return [];
	}

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();

	const dt = getGtfsDateTime();
	const hoursAhead = UPCOMING_TRIPS_HOURS_AHEAD;
	const minutesFilter = createMinutesFilter(stop_times.departure_time);
	const serviceWindowFilter = createUpcomingServiceWindowFilter(
		minutesFilter,
		dt,
		hoursAhead,
	);

	try {
		const data = await db
			.select({
				operator: trips.operator,
				shape_id: trips.shape_id,
				trip_id: trips.trip_id,
				route_short_name: routes.route_short_name,
				route_long_name: routes.route_long_name,
				route_type: routes.route_type,
				route_desc: routes.route_desc,
				stop_headsign: stop_times.stop_headsign,
				departure_time: stop_times.departure_time,
				stop_name: stops.stop_name,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.innerJoin(
				stop_times,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.operator, stop_times.operator),
				),
			)
			.innerJoin(
				stops,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
				),
			)
			.leftJoin(
				calendarDates,
				and(
					eq(trips.service_id, calendarDates.service_id),
					eq(trips.operator, calendarDates.operator),
				),
			)
			.where(
				and(
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(stop_times.operator, operator),
					eq(stops.operator, operator),
					eq(calendarDates.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					eq(stops.feed_version, feed.stops),
					eq(calendarDates.feed_version, feed.calendarDates),
					eq(routes.route_short_name, busLine),
					eq(stops.stop_name, stop_name),
					eq(calendarDates.exception_type, 1),
					serviceWindowFilter,
				),
			)
			.groupBy(
				trips.operator,
				trips.trip_id,
				routes.route_short_name,
				routes.route_long_name,
				routes.route_type,
				routes.route_desc,
				stop_times.stop_headsign,
				stop_times.departure_time,
				stops.stop_name,
				stop_times.stop_sequence,
				stops.stop_id,
				stops.stop_lat,
				stops.stop_lon,
				trips.feed_version,
				trips.shape_id,
			)
			.orderBy(stop_times.departure_time)
			.limit(UPCOMING_TRIPS_LIMIT);
		const parsed = z.array(selectAllSchema).parse(data) as IDbData[];
		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};

export interface IStopDepartureSchedule {
	stationStopId: string;
	stationStopIds: string[];
	departures: IDbData[];
}

export interface IResolvedStopBoardIds {
	stationStopId: string;
	stationStopIds: string[];
	boardStopIds: string[];
}

const STOP_BOARD_GROUP_MAX_DISTANCE_METERS = 750;

export const resolveStopBoardStopIdsFromDatabase = async (
	stopId: string,
	operatorInput = getDefaultOperator(),
): Promise<IResolvedStopBoardIds> => {
	const trimmedStopId = stopId.trim();
	if (!trimmedStopId) {
		return { stationStopId: "", stationStopIds: [], boardStopIds: [] };
	}

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const [selectedStop] = await db
			.select({
				stop_id: stops.stop_id,
				parent_station: stops.parent_station,
				location_type: stops.location_type,
				platform_code: stops.platform_code,
				stop_name: stops.stop_name,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(stops)
			.where(
				and(
					eq(stops.operator, operator),
					eq(stops.feed_version, feed.stops),
					eq(stops.stop_id, trimmedStopId),
				),
			)
			.limit(1);

		if (!selectedStop?.stop_id) {
			return {
				stationStopId: trimmedStopId,
				stationStopIds: [trimmedStopId],
				boardStopIds: [],
			};
		}

		const parentId = selectedStop.parent_station?.trim();
		const stationStopId =
			selectedStop.location_type === 1
				? selectedStop.stop_id
				: parentId || selectedStop.stop_id;
		const shouldExpandToStationPlatforms = shouldExpandStopBoardToStation(
			selectedStop.location_type,
			parentId,
			selectedStop.platform_code,
		);
		const directPlatformRows = shouldExpandToStationPlatforms
			? await db
					.select({ stop_name: stops.stop_name })
					.from(stops)
					.where(
						and(
							eq(stops.operator, operator),
							eq(stops.feed_version, feed.stops),
							eq(stops.location_type, 0),
							eq(stops.parent_station, stationStopId),
						),
					)
			: [];
		const groupStopNames = [
			...new Set(
				[
					selectedStop.location_type === 0 ? selectedStop.stop_name : null,
					...directPlatformRows.map((row) => row.stop_name),
				]
					.map((name) => name?.trim())
					.filter((name): name is string => Boolean(name)),
			),
		];
		const platformRows = shouldExpandToStationPlatforms
			? await db
					.select({
						stop_id: stops.stop_id,
						parent_station: stops.parent_station,
						stop_lat: stops.stop_lat,
						stop_lon: stops.stop_lon,
					})
					.from(stops)
					.where(
						and(
							eq(stops.operator, operator),
							eq(stops.feed_version, feed.stops),
							eq(stops.location_type, 0),
							or(
								eq(stops.parent_station, stationStopId),
								...groupStopNames.map(
									(name) => sql`lower(${stops.stop_name}) = lower(${name})`,
								),
							),
						),
					)
			: [];
		const groupedPlatformRows = platformRows.filter((row) => {
			if (row.parent_station === stationStopId) return true;
			if (
				selectedStop.stop_lat == null ||
				selectedStop.stop_lon == null ||
				row.stop_lat == null ||
				row.stop_lon == null
			) {
				return false;
			}
			return (
				getDistanceFromLatLon(
					Number(selectedStop.stop_lat),
					Number(selectedStop.stop_lon),
					Number(row.stop_lat),
					Number(row.stop_lon),
				) <= STOP_BOARD_GROUP_MAX_DISTANCE_METERS
			);
		});
		const platformStopIds = groupedPlatformRows
			.map((row) => row.stop_id)
			.filter((id): id is string => Boolean(id));
		const stationStopIds = [
			...new Set([
				stationStopId,
				...groupedPlatformRows
					.map((row) => row.parent_station?.trim())
					.filter((id): id is string => Boolean(id)),
			]),
		];

		return {
			stationStopId,
			stationStopIds,
			boardStopIds:
				shouldExpandToStationPlatforms && platformStopIds.length > 0
					? platformStopIds
					: [selectedStop.stop_id],
		};
	} catch (error) {
		console.log(error);
		return {
			stationStopId: trimmedStopId,
			stationStopIds: [trimmedStopId],
			boardStopIds: [],
		};
	}
};

export const selectStopBoardChildrenFromDatabase = async (
	stationStopIds: string[],
	operatorInput = getDefaultOperator(),
): Promise<IStopBoardChild[]> => {
	const cleanedStationStopIds = [
		...new Set(stationStopIds.map((id) => id.trim()).filter(Boolean)),
	];
	if (cleanedStationStopIds.length === 0) return [];

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const rows = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				location_type: stops.location_type,
				parent_station: stops.parent_station,
				platform_code: stops.platform_code,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(stops)
			.where(
				and(
					eq(stops.operator, operator),
					eq(stops.feed_version, feed.stops),
					inArray(stops.parent_station, cleanedStationStopIds),
				),
			);

		return rows.flatMap((row) => {
			if (
				!row.stop_id ||
				row.stop_lat == null ||
				row.stop_lon == null ||
				!row.parent_station
			) {
				return [];
			}
			return [
				{
					stop_id: row.stop_id,
					stop_name: row.stop_name ?? "",
					location_type: row.location_type ?? 0,
					parent_station: row.parent_station,
					platform_code: row.platform_code?.trim() || null,
					stop_lat: Number(row.stop_lat),
					stop_lon: Number(row.stop_lon),
				},
			];
		});
	} catch (error) {
		console.log(error);
		return [];
	}
};

/**
 * Upcoming departures across every route at a stop/station.
 * Parent stations and their children resolve to all served platform stop IDs.
 */
export const selectUpcomingDeparturesForStopFromDatabase = async (
	stopId: string,
	operatorInput = getDefaultOperator(),
): Promise<IStopDepartureSchedule> => {
	const trimmedStopId = stopId.trim();
	if (!trimmedStopId) {
		return { stationStopId: "", stationStopIds: [], departures: [] };
	}

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();

	try {
		const { stationStopId, stationStopIds, boardStopIds } =
			await resolveStopBoardStopIdsFromDatabase(trimmedStopId, operator);
		if (boardStopIds.length === 0) {
			return {
				stationStopId: trimmedStopId,
				stationStopIds,
				departures: [],
			};
		}

		const dt = getGtfsDateTime();
		const hoursAhead = UPCOMING_TRIPS_HOURS_AHEAD;
		const minutesFilter = createMinutesFilter(stop_times.departure_time);
		const serviceWindowFilter = createUpcomingServiceWindowFilter(
			minutesFilter,
			dt,
			hoursAhead,
		);

		const data = await db
			.select({
				operator: trips.operator,
				shape_id: trips.shape_id,
				trip_id: trips.trip_id,
				route_short_name: routes.route_short_name,
				route_long_name: routes.route_long_name,
				route_type: routes.route_type,
				route_desc: routes.route_desc,
				stop_headsign: stop_times.stop_headsign,
				departure_time: stop_times.departure_time,
				stop_name: stops.stop_name,
				platform_code: stops.platform_code,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.innerJoin(
				stop_times,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.operator, stop_times.operator),
				),
			)
			.innerJoin(
				stops,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.operator, stops.operator),
				),
			)
			.leftJoin(
				calendarDates,
				and(
					eq(trips.service_id, calendarDates.service_id),
					eq(trips.operator, calendarDates.operator),
				),
			)
			.where(
				and(
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(stop_times.operator, operator),
					eq(stops.operator, operator),
					eq(calendarDates.operator, operator),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					eq(stop_times.feed_version, feed.stopTimes),
					eq(stops.feed_version, feed.stops),
					eq(calendarDates.feed_version, feed.calendarDates),
					inArray(stop_times.stop_id, boardStopIds),
					eq(calendarDates.exception_type, 1),
					serviceWindowFilter,
				),
			)
			.groupBy(
				trips.operator,
				trips.trip_id,
				routes.route_short_name,
				routes.route_long_name,
				routes.route_type,
				routes.route_desc,
				stop_times.stop_headsign,
				stop_times.departure_time,
				stops.stop_name,
				stops.platform_code,
				stop_times.stop_sequence,
				stops.stop_id,
				stops.stop_lat,
				stops.stop_lon,
				trips.feed_version,
				trips.shape_id,
			)
			.orderBy(stop_times.departure_time)
			.limit(UPCOMING_TRIPS_LIMIT);

		return {
			stationStopId,
			stationStopIds,
			departures: z.array(selectAllSchema).parse(data) as IDbData[],
		};
	} catch (error) {
		console.log(error);
		return {
			stationStopId: trimmedStopId,
			stationStopIds: [trimmedStopId],
			departures: [],
		};
	}
};

export interface IStopRouteShapeRef {
	route_short_name: string;
	route_type: number | null;
	shape_id: string;
}

export const selectDistinctShapesForStopFromDatabase = async (
	stopId: string,
	operatorInput = getDefaultOperator(),
): Promise<IStopRouteShapeRef[]> => {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	const { boardStopIds } = await resolveStopBoardStopIdsFromDatabase(
		stopId,
		operator,
	);
	if (boardStopIds.length === 0) return [];

	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				route_short_name: routes.route_short_name,
				route_type: routes.route_type,
				shape_id: trips.shape_id,
			})
			.from(stop_times)
			.innerJoin(
				trips,
				and(
					eq(stop_times.trip_id, trips.trip_id),
					eq(stop_times.operator, trips.operator),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(trips.route_id, routes.route_id),
					eq(trips.operator, routes.operator),
				),
			)
			.where(
				and(
					eq(stop_times.operator, operator),
					eq(trips.operator, operator),
					eq(routes.operator, operator),
					eq(stop_times.feed_version, feed.stopTimes),
					eq(trips.feed_version, feed.trips),
					eq(routes.feed_version, feed.routes),
					inArray(stop_times.stop_id, boardStopIds),
					isNotNull(trips.shape_id),
				),
			)
			.groupBy(routes.route_short_name, routes.route_type, trips.shape_id);

		return data
			.filter(
				(
					row,
				): row is {
					route_short_name: string;
					route_type: number | null;
					shape_id: string;
				} => Boolean(row.route_short_name && row.shape_id),
			)
			.map((row) => ({
				route_short_name: row.route_short_name,
				route_type: row.route_type,
				shape_id: row.shape_id,
			}));
	} catch (error) {
		console.log(error);
		return [];
	}
};

export const selectShapesForIdsFromDatabase = async (
	shapeIds: string[],
	operatorInput = getDefaultOperator(),
): Promise<IShapes[]> => {
	const uniqueShapeIds = [...new Set(shapeIds.filter(Boolean))];
	if (uniqueShapeIds.length === 0) return [];

	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				shape_id: shapes.shape_id,
				shape_pt_lat: shapes.shape_pt_lat,
				shape_pt_lon: shapes.shape_pt_lon,
				shape_pt_sequence: shapes.shape_pt_sequence,
				shape_dist_traveled: shapes.shape_dist_traveled,
			})
			.from(shapes)
			.where(
				and(
					eq(shapes.operator, operator),
					eq(shapes.feed_version, feed.shapes),
					inArray(shapes.shape_id, uniqueShapeIds),
				),
			)
			.orderBy(shapes.shape_id, shapes.shape_pt_sequence);

		return data.map((point) => ({
			shape_id: point.shape_id,
			shape_pt_lat: Number(point.shape_pt_lat),
			shape_pt_lon: Number(point.shape_pt_lon),
			shape_pt_sequence: point.shape_pt_sequence,
			shape_dist_traveled:
				point.shape_dist_traveled != null
					? Number(point.shape_dist_traveled)
					: undefined,
		}));
	} catch (error) {
		console.log(error);
		return [];
	}
};

export const selectShapesFromDatabase = async (
	shapeId: string,
	operatorInput = getDefaultOperator(),
) => {
	const operator = resolveOperator(operatorInput);
	const feed = latestFeedVersionsByOperator(operator);
	MetricsTracker.trackDbQuery();
	try {
		const shapePoints = await db
			.select({
				shape_id: shapes.shape_id,
				shape_pt_lat: shapes.shape_pt_lat,
				shape_pt_lon: shapes.shape_pt_lon,
				shape_pt_sequence: shapes.shape_pt_sequence,
				shape_dist_traveled: shapes.shape_dist_traveled,
			})
			.from(shapes)
			.where(
				and(
					eq(shapes.shape_id, shapeId),
					eq(shapes.operator, operator),
					eq(shapes.feed_version, feed.shapes),
				),
			)
			.orderBy(shapes.shape_pt_sequence);

		// Convert numeric strings to numbers (PostgreSQL numeric() returns strings)
		return shapePoints.map((point) => ({
			shape_id: point.shape_id,
			shape_pt_lat: Number(point.shape_pt_lat),
			shape_pt_lon: Number(point.shape_pt_lon),
			shape_pt_sequence: point.shape_pt_sequence,
			shape_dist_traveled: point.shape_dist_traveled
				? Number(point.shape_dist_traveled)
				: undefined,
		}));
	} catch (error) {
		console.log(error);
		return [];
	}
};
