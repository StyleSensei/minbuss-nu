import { trips } from "@shared/db/schema/trips";
import { routes } from "@shared/db/schema/routes";
import { eq, inArray, and, desc, sql } from "drizzle-orm";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import type { IDbData } from "@shared/models/IDbData";
import { getCurrentTripIds } from "@/app/actions/getCurrentTripIds";
import { selectAllSchema } from "@shared/db/schema/selectAll";
import { z } from "zod";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { calendarDates } from "@/shared/db/schema/calendar_dates";
import { getDb } from "./db";

const db = getDb();

function getExtendedStartTime(timeWindowStart: {
	hour: number;
	minute: number;
}): string {
	return formatTimeForSQL(timeWindowStart.hour + 24, timeWindowStart.minute);
}

function formatTimeForSQL(hours: number, minutes: number): string {
	return `${hours.toString().padStart(2, "0")}:${minutes
		.toString()
		.padStart(2, "0")}:00`;
}

function getDateArray(isEarlyMorning = false): Date[] {
	const now = new Date();
	const today = new Date(now);

	const dates = [today];

	if (isEarlyMorning) {
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		dates.push(yesterday);
	}

	return dates;
}

export const selectCurrentTripsFromDatabase = async (busLine: string) => {
	MetricsTracker.trackDbQuery();
	const { filteredTripIds } = await getCurrentTripIds();

	try {
		const data = await db
			.select({
				trip_id: trips.trip_id,
				route_short_name: routes.route_short_name,
				stop_headsign: stop_times.stop_headsign,
				departure_time: stop_times.departure_time,
				stop_name: stops.stop_name,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(trips)
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.innerJoin(stop_times, eq(trips.trip_id, stop_times.trip_id))
			.innerJoin(stops, eq(stop_times.stop_id, stops.stop_id))
			.where(
				and(
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

	const now = new Date();
	const currentHour = now.getHours();
	const currentMinutes = now.getMinutes();
	const isEarlyMorning = currentHour < 4;

	const timeWindowStartDate = new Date(now);
	timeWindowStartDate.setMinutes(timeWindowStartDate.getMinutes() - 15);

	const timeWindowStart = {
		hour: timeWindowStartDate.getHours() + (isEarlyMorning ? 24 : 0),
		minute: timeWindowStartDate.getMinutes(),
	};

	const timeWindowEnd = {
		hour: isEarlyMorning ? currentHour + 6 + 24 : currentHour + 6,
		minute: currentMinutes,
	};

	const extendedStartTime = getExtendedStartTime(timeWindowStart);

	const timeFifteenMinBeforeDep = formatTimeForSQL(
		timeWindowStart.hour,
		timeWindowStart.minute,
	);

	const timeSixHoursAfter = formatTimeForSQL(
		timeWindowEnd.hour,
		timeWindowEnd.minute,
	);

	const timeFilter = isEarlyMorning
		? sql`(
			   (
			   (${stop_times.departure_time} >= ${timeFifteenMinBeforeDep} AND ${stop_times.departure_time} < '04:00:00') 
			   OR 
			   (${stop_times.departure_time} >= ${extendedStartTime} AND ${stop_times.departure_time} < '28:00:00')
			  )
			 )`
		: sql`${stop_times.departure_time} >= ${timeFifteenMinBeforeDep} AND 
             ${stop_times.departure_time} <= ${timeSixHoursAfter}`;

	const dates = getDateArray(isEarlyMorning);

	try {
		const data = await db
			.select({
				trip_id: trips.trip_id,
				route_short_name: routes.route_short_name,
				stop_headsign: stop_times.stop_headsign,
				departure_time: stop_times.departure_time,
				stop_name: stops.stop_name,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(trips)
			.innerJoin(routes, eq(trips.route_id, routes.route_id))
			.innerJoin(stop_times, eq(trips.trip_id, stop_times.trip_id))
			.innerJoin(stops, eq(stop_times.stop_id, stops.stop_id))
			.leftJoin(calendarDates, eq(trips.service_id, calendarDates.service_id))
			.where(
				and(
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
			.limit(500);
		const parsed = z.array(selectAllSchema).parse(data) as IDbData[];

		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};
