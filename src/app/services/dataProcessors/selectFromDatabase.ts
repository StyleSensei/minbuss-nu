import { trips } from "@shared/db/schema/trips";
import { routes } from "@shared/db/schema/routes";
import { eq, inArray, and, sql, gte, lte } from "drizzle-orm";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import type { IDbData } from "@shared/models/IDbData";
import { selectAllSchema } from "@shared/db/schema/selectAll";
import { z } from "zod";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { calendarDates } from "@/shared/db/schema/calendar_dates";
import { getDb } from "./db";
import { DateTime } from "luxon";
import { getCachedVehiclePositions } from "@/app/services/cacheHelper";
import {
	calculateTimeFilter,
	createMinutesFilter,
} from "@/app/utilities/calculateTimeFilter";
import { shapes } from "@/shared/db/schema/shapes";
import { getDistanceFromLatLon } from "@/app/utilities/getDistanceFromLatLon";
import { isStopIdExcludedFromClient } from "@/app/utilities/stopIdRules";

const db = getDb();

function getDateArray(isEarlyMorning = false) {
	const dt = DateTime.local();
	const today = dt.toFormat("yyyy-MM-dd");
	if (isEarlyMorning) {
		const yesterday = dt.minus({ days: 1 }).toFormat("yyyy-MM-dd");

		return [today, yesterday];
	}
	return [today];
}

const latestFeedVersion = sql`(SELECT MAX(${trips.feed_version}) FROM trips)`;

export const selectCurrentTripsFromDatabase = async (busLine: string) => {
	MetricsTracker.trackDbQuery();
	const cachedVehiclePositions = await getCachedVehiclePositions();
	const filteredTripIds = cachedVehiclePositions.data
		.map((vehicle) => vehicle?.trip?.tripId)
		.filter((tripId): tripId is string => typeof tripId === "string");

	try {
		const data = await db
			.select({
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
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.innerJoin(stop_times, eq(trips.trip_id, stop_times.trip_id))
			.innerJoin(stops, eq(stop_times.stop_id, stops.stop_id))
			.where(
				and(
					eq(trips.feed_version, latestFeedVersion),
					eq(routes.feed_version, latestFeedVersion),
					eq(stop_times.feed_version, latestFeedVersion),
					eq(stops.feed_version, latestFeedVersion),
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
): Promise<IDbData[]> => {
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				route_short_name: routes.route_short_name,
				feed_version: trips.feed_version,
			})
			.from(trips)
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.innerJoin(stop_times, eq(trips.trip_id, stop_times.trip_id))
			.innerJoin(stops, eq(stop_times.stop_id, stops.stop_id))
			.where(
				and(
					eq(trips.feed_version, latestFeedVersion),
					eq(routes.feed_version, latestFeedVersion),
					eq(stop_times.feed_version, latestFeedVersion),
					eq(stops.feed_version, latestFeedVersion),
					eq(routes.route_short_name, busLine),
				),
			)
			.groupBy(
				stops.stop_id,
				stops.stop_name,
				stops.stop_lat,
				stops.stop_lon,
				routes.route_short_name,
				trips.feed_version,
			);

		return data.map((row) => ({
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
): Promise<string[]> => {
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				shape_id: trips.shape_id,
			})
			.from(trips)
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.where(
				and(
					eq(trips.feed_version, latestFeedVersion),
					eq(routes.feed_version, latestFeedVersion),
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
): Promise<string[]> => {
	if (!stopId.trim()) {
		return [];
	}
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({ route_short_name: routes.route_short_name })
			.from(stop_times)
			.innerJoin(trips, eq(stop_times.trip_id, trips.trip_id))
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.where(
				and(
					eq(trips.feed_version, latestFeedVersion),
					eq(routes.feed_version, latestFeedVersion),
					eq(stop_times.feed_version, latestFeedVersion),
					eq(stop_times.stop_id, stopId),
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
): Promise<Record<string, string[]>> => {
	const cleanedStopIds = [...new Set(stopIds.map((id) => id.trim()).filter(Boolean))];
	if (cleanedStopIds.length === 0) {
		return {};
	}

	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				stop_id: stop_times.stop_id,
				route_short_name: routes.route_short_name,
			})
			.from(stop_times)
			.innerJoin(trips, eq(stop_times.trip_id, trips.trip_id))
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.where(
				and(
					eq(trips.feed_version, latestFeedVersion),
					eq(routes.feed_version, latestFeedVersion),
					eq(stop_times.feed_version, latestFeedVersion),
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
): Promise<(INearbyStopRow & { feed_version: string }) | null> => {
	if (!stopId.trim()) {
		return null;
	}
	MetricsTracker.trackDbQuery();
	try {
		const rows = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
				feed_version: stops.feed_version,
			})
			.from(stops)
			.innerJoin(
				stop_times,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				trips,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(routes.route_id, trips.route_id),
					eq(routes.feed_version, latestFeedVersion),
				),
			)
			.where(
				and(
					eq(stops.feed_version, latestFeedVersion),
					eq(stops.stop_id, stopId),
				),
			)
			.limit(1);
		const row = rows[0];
		if (!row?.stop_id) {
			return null;
		}
		return {
			stop_id: row.stop_id,
			stop_name: row.stop_name ?? "",
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
	stop_lat: number;
	stop_lon: number;
}

const NEARBY_BBOX_DEG = 0.05;
const NEARBY_CANDIDATE_CAP = 800;

/** Stops nearest to a point; bbox prefilter then Haversine sort. */
export const selectNearestStopsFromDatabase = async (
	lat: number,
	lng: number,
	limit = 10,
): Promise<INearbyStopRow[]> => {
	MetricsTracker.trackDbQuery();
	try {
		const data = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(stops)
			.innerJoin(
				stop_times,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				trips,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(routes.route_id, trips.route_id),
					eq(routes.feed_version, latestFeedVersion),
				),
			)
			.where(
				and(
					eq(stops.feed_version, latestFeedVersion),
					gte(stops.stop_lat, lat - NEARBY_BBOX_DEG),
					lte(stops.stop_lat, lat + NEARBY_BBOX_DEG),
					gte(stops.stop_lon, lng - NEARBY_BBOX_DEG),
					lte(stops.stop_lon, lng + NEARBY_BBOX_DEG),
				),
			)
			.groupBy(stops.stop_id, stops.stop_name, stops.stop_lat, stops.stop_lon)
			.limit(NEARBY_CANDIDATE_CAP);

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
): Promise<INearbyStopRow[]> => {
	const trimmed = query.trim().replace(/[%_]/g, "");
	if (trimmed.length < 2) {
		return [];
	}
	MetricsTracker.trackDbQuery();
	const pattern = `%${trimmed}%`;
	try {
		const data = await db
			.select({
				stop_id: stops.stop_id,
				stop_name: stops.stop_name,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(stops)
			.innerJoin(
				stop_times,
				and(
					eq(stop_times.stop_id, stops.stop_id),
					eq(stop_times.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				trips,
				and(
					eq(trips.trip_id, stop_times.trip_id),
					eq(trips.feed_version, latestFeedVersion),
				),
			)
			.innerJoin(
				routes,
				and(
					eq(routes.route_id, trips.route_id),
					eq(routes.feed_version, latestFeedVersion),
				),
			)
			.where(
				and(
					eq(stops.feed_version, latestFeedVersion),
					sql`lower(${stops.stop_name}) like lower(${pattern})`,
				),
			)
			.groupBy(stops.stop_id, stops.stop_name, stops.stop_lat, stops.stop_lon)
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
				stop_lat: Number(row.stop_lat),
				stop_lon: Number(row.stop_lon),
			}));
	} catch (error) {
		console.log(error);
		return [];
	}
};

export const selectUpcomingTripsFromDatabase = async (
	busLine: string,
	stop_name: string,
): Promise<IDbData[]> => {
	if (!stop_name.trim()) {
		return [];
	}

	MetricsTracker.trackDbQuery();

	const dt = DateTime.local();
	const currentHour = dt.hour;
	const hoursAhead = 6;
	const isEarlyMorning = currentHour < 4;

	const minutesFilter = createMinutesFilter(stop_times.departure_time);

	const startTimeMinutes =
		dt.minus({ minutes: 15 }).hour * 60 + dt.minus({ minutes: 15 }).minute;
	const endTimeMinutes =
		(isEarlyMorning ? dt.hour + hoursAhead + 24 : dt.hour + hoursAhead) * 60 +
		dt.minute;

	const timeFilter = calculateTimeFilter({
		minutesFilter,
		startTimeMinutes,
		endTimeMinutes,
		isEarlyMorning,
	});

	const dates = getDateArray(isEarlyMorning).map(
		(dateStr) => new Date(dateStr),
	);

	try {
		const data = await db
			.select({
				shape_id: trips.shape_id,
				trip_id: trips.trip_id,
				route_short_name: routes.route_short_name,
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
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.innerJoin(stop_times, eq(trips.trip_id, stop_times.trip_id))
			.innerJoin(stops, eq(stop_times.stop_id, stops.stop_id))
			.leftJoin(calendarDates, eq(trips.service_id, calendarDates.service_id))
			.where(
				and(
					eq(trips.feed_version, latestFeedVersion),
					eq(routes.feed_version, latestFeedVersion),
					eq(stop_times.feed_version, latestFeedVersion),
					eq(stops.feed_version, latestFeedVersion),
					eq(calendarDates.feed_version, latestFeedVersion),
					eq(routes.route_short_name, busLine),
					eq(stops.stop_name, stop_name),
					inArray(calendarDates.date, dates),
					eq(calendarDates.exception_type, 1),
					timeFilter,
				),
			)
			.groupBy(
				trips.trip_id,
				routes.route_short_name,
				stop_times.stop_headsign,
				stop_times.departure_time,
				stops.stop_name,
				stop_times.stop_sequence,
				stops.stop_id,
				stops.stop_lat,
				stops.stop_lon,
			)
			.orderBy(stop_times.departure_time)
			.limit(100);
		const parsed = z.array(selectAllSchema).parse(data) as IDbData[];
		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};

export const selectShapesFromDatabase = async (shapeId: string) => {
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
			.where(eq(shapes.shape_id, shapeId))
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
