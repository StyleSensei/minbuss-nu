import { DateTime } from "luxon";
import { GTFS_SERVICE_TIMEZONE } from "@/app/utilities/gtfsTimeContext";

/** GTFS convention: 00:00–03:59 belongs to the previous service day. */
export function isGtfsEarlyMorning(hour: number): boolean {
	return hour < 4;
}

/** Extended end-of-window minutes used for early-morning queries (matches legacy logic). */
export function getEarlyMorningEndTimeMinutes(
	hour: number,
	minute: number,
	hoursAhead: number,
): number {
	return (hour + hoursAhead + 24) * 60 + minute;
}

export interface ServiceDayWindowClause {
	serviceDate: string;
	minMinutes: number;
	maxMinutes: number;
}

/**
 * Minute ranges per calendar service date for the normal (non–early-morning) window.
 */
export function buildUpcomingServiceDayWindows(
	dt: DateTime,
	hoursAhead: number,
): ServiceDayWindowClause[] {
	const windowStart = dt.minus({ minutes: 15 });
	const windowEnd = dt.plus({ hours: hoursAhead });

	const serviceDays = [
		dt.minus({ days: 1 }).startOf("day"),
		dt.startOf("day"),
		dt.plus({ days: 1 }).startOf("day"),
	];

	return serviceDays.flatMap((serviceDay) => {
		const minMinutes = Math.max(
			0,
			Math.floor(windowStart.diff(serviceDay, "minutes").minutes),
		);
		const maxMinutes = Math.ceil(windowEnd.diff(serviceDay, "minutes").minutes);
		if (maxMinutes < minMinutes) return [];

		return [
			{
				serviceDate: serviceDay.toFormat("yyyy-MM-dd"),
				minMinutes,
				maxMinutes,
			},
		];
	});
}

/** Chronological sort key: service date + GTFS minutes (handles 25:30 etc.). */
export function departureSortEpochMs(
	serviceDate: string,
	departureTime: string,
): number {
	const [h, m] = departureTime.split(":").map(Number);
	const minutes = h * 60 + m;
	const base = DateTime.fromISO(serviceDate, { zone: GTFS_SERVICE_TIMEZONE })
		.startOf("day")
		.toMillis();
	return base + minutes * 60_000;
}

/** Compare departures for chronological board order (matches SQL orderBy). */
export function compareDeparturesChronologically(
	a: { serviceDate: string; departureTime: string },
	b: { serviceDate: string; departureTime: string },
): number {
	return (
		departureSortEpochMs(a.serviceDate, a.departureTime) -
		departureSortEpochMs(b.serviceDate, b.departureTime)
	);
}

/** Wall-clock instant for a scheduled departure (GTFS service date + departure_time). */
export function departureInstantFromServiceDate(
	serviceDate: string,
	departureTime: string,
): Date {
	return new Date(departureSortEpochMs(serviceDate, departureTime));
}
