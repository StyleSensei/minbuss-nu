import { trips } from "@shared/db/schema/trips";
import { routes } from "@shared/db/schema/routes";
import { eq, inArray, and, sql } from "drizzle-orm";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import type { IDbData } from "@shared/models/IDbData";
import { getCurrentTripIds } from "@/app/actions/getCurrentTripIds";
import { selectAllSchema } from "@shared/db/schema/selectAll";
import { z } from "zod";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { calendarDates } from "@/shared/db/schema/calendar_dates";
import { getDb } from "./db";
import { DateTime } from "luxon";
import {
	calculateTimeFilter,
	createMinutesFilter,
} from "@/app/utilities/calculateTimeFilter";
import { shapes } from "@/shared/db/schema/shapes";

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
	const { filteredTripIds } = await getCurrentTripIds();

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

export const selectUpcomingTripsFromDatabase = async (
	busLine: string,
	stop_name: string,
): Promise<IDbData[]> => {
	MetricsTracker.trackDbQuery();

	const dt = DateTime.local();
	const currentHour = dt.hour;
	const isEarlyMorning = currentHour < 4;

	const minutesFilter = createMinutesFilter(stop_times.departure_time);

	const startTimeMinutes =
		dt.minus({ minutes: 15 }).hour * 60 + dt.minus({ minutes: 15 }).minute;
	const endTimeMinutes =
		(isEarlyMorning ? dt.hour + 6 + 24 : dt.hour + 6) * 60 + dt.minute;

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
    shape_pt_lat: shapes.shape_pt_lat,
    shape_pt_lon: shapes.shape_pt_lon,
    shape_pt_sequence: shapes.shape_pt_sequence,
    shape_dist_traveled: shapes.shape_dist_traveled,
  })
  .from(shapes)
  .where(eq(shapes.shape_id, shapeId))
  .orderBy(shapes.shape_pt_sequence);
		return shapePoints;
	} catch (error) {
		console.log(error);
		return [];
	}
}
