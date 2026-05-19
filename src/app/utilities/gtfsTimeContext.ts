import { DateTime } from "luxon";

/** GTFS schedule times for Swedish operators are expressed in local civil time. */
export const GTFS_SERVICE_TIMEZONE = "Europe/Stockholm";

export function getGtfsDateTime(): DateTime {
	return DateTime.now().setZone(GTFS_SERVICE_TIMEZONE);
}
