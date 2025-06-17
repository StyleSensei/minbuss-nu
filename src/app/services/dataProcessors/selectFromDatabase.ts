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
	const month = now.getMonth() + 1;
	const day = now.getDate();
	let yesterdayStr = "";
	if (isEarlyMorning) {
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayYear = yesterday.getFullYear();
		const yesterdayMonth = (yesterday.getMonth() + 1)
			.toString()
			.padStart(2, "0");
		const yesterdayDay = yesterday.getDate().toString().padStart(2, "0");
		yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
	}

	const todayStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

	const dateStrings = isEarlyMorning ? [todayStr, yesterdayStr] : [todayStr];
	const dates = dateStrings.map((dateStr) => new Date(dateStr));

	const formatTimeForSQL = (hours: number, minutes: number): string => {
		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:00`;
	};
	let fifteenMinBeforeHour = currentHour;
	let fifteenMinBeforeMinute = currentMinutes - 15;
	let fourHoursAfterHour = currentHour + 4;

	if (fifteenMinBeforeMinute < 0) {
		fifteenMinBeforeMinute += 60;
		fifteenMinBeforeHour -= 1;
	}

	if (fifteenMinBeforeHour < 0) {
		fifteenMinBeforeHour = 23;
	}
	if (isEarlyMorning) {
		fifteenMinBeforeHour += 24;
		fourHoursAfterHour += 24;
	}

	const timeFifteenMinBeforeDep = formatTimeForSQL(
		fifteenMinBeforeHour,
		fifteenMinBeforeMinute,
	);

	const timeFourHoursAfter = formatTimeForSQL(
		fourHoursAfterHour,
		currentMinutes,
	);

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
					sql`${stop_times.departure_time} >= ${timeFifteenMinBeforeDep}`,
					sql`${stop_times.departure_time} <= ${timeFourHoursAfter}`,
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
