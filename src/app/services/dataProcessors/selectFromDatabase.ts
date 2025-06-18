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
			.orderBy(desc(trips.trip_id), desc(stop_times.departure_time))
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

	const year = now.getFullYear();
	const month = (now.getMonth() + 1).toString().padStart(2, "0");
	const day = now.getDate().toString().padStart(2, "0");

	// Format today's date as YYYY-MM-DD
	const todayStr = `${year}-${month}-${day}`;

	// Calculate yesterday's date for early morning hours
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayYear = yesterday.getFullYear();
	const yesterdayMonth = (yesterday.getMonth() + 1).toString().padStart(2, "0");
	const yesterdayDay = yesterday.getDate().toString().padStart(2, "0");
	const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;

	// We'll include yesterday's services if it's early morning (midnight to 4 AM)
	const dateStrings = isEarlyMorning ? [todayStr, yesterdayStr] : [todayStr];
	const dates = dateStrings.map((dateStr) => new Date(dateStr));

	const formatTimeForSQL = (hours: number, minutes: number): string => {
		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:00`;
	};

	// Time window calculation
	const timeWindowStart = {
		hour: currentHour,
		minute: currentMinutes - 15, // 15 minutes before current time
	};

	// Handle minute underflow
	if (timeWindowStart.minute < 0) {
		timeWindowStart.minute += 60;
		timeWindowStart.hour -= 1;
	}

	// Handle hour underflow
	if (timeWindowStart.hour < 0) {
		timeWindowStart.hour = 23;
	}

	const timeWindowEnd = {
		hour: currentHour + 6,
		minute: currentMinutes,
	};

	// Special handling for after-midnight (0-4 AM)
	let extendedStartTime = "";
	if (isEarlyMorning) {
		// For times between midnight and 4 AM, we also want to include trips with "extended hours" (24+)
		// from the previous day's schedule

		// For early morning, add extended format start time to catch yesterday's trips
		extendedStartTime = formatTimeForSQL(
			timeWindowStart.hour + 24,
			timeWindowStart.minute,
		);

		// For the future window, add 24 hours for extended day format comparison
		// This is needed for GTFS data that uses 24+ hours for early morning times
		timeWindowEnd.hour += 24;
	}

	const timeFifteenMinBeforeDep = formatTimeForSQL(
		timeWindowStart.hour,
		timeWindowStart.minute,
	);

	const timeSixHoursAfter = formatTimeForSQL(
		timeWindowEnd.hour,
		timeWindowEnd.minute,
	);

	// For early morning hours, we need a special query that handles both regular time format
	// and extended day format (24+ hours)
	const timeFilter = isEarlyMorning
		? sql`(
			   (${stop_times.departure_time} >= ${timeFifteenMinBeforeDep}) 
			   OR 
			   (${stop_times.departure_time} >= ${extendedStartTime} AND ${stop_times.departure_time} < '24:00:00')
			  )`
		: sql`${stop_times.departure_time} >= ${timeFifteenMinBeforeDep} AND 
             ${stop_times.departure_time} <= ${timeSixHoursAfter}`;

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
			.orderBy(desc(trips.trip_id), desc(stop_times.departure_time))
			.limit(500);
		const parsed = z.array(selectAllSchema).parse(data) as IDbData[];

		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};
