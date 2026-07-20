import { calendarDates } from "@shared/db/schema/calendar_dates";
import { routes } from "@shared/db/schema/routes";
import { shapes } from "@shared/db/schema/shapes";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import { trips } from "@shared/db/schema/trips";
import { sql } from "drizzle-orm";

/**
 * Latest feed_version per GTFS table for an operator.
 *
 * Imports can leave tables on different dates (e.g. stop_times failed while
 * stops/trips upserted). Joining everything against MAX(trips.feed_version)
 * then yields zero rows — use each table's own MAX instead.
 */
export function latestFeedVersionsByOperator(operator: string) {
	return {
		trips: sql`(SELECT MAX(${trips.feed_version}) FROM trips WHERE ${trips.operator} = ${operator})`,
		routes: sql`(SELECT MAX(${routes.feed_version}) FROM routes WHERE ${routes.operator} = ${operator})`,
		stops: sql`(SELECT MAX(${stops.feed_version}) FROM stops WHERE ${stops.operator} = ${operator})`,
		stopTimes: sql`(SELECT MAX(${stop_times.feed_version}) FROM stop_times WHERE ${stop_times.operator} = ${operator})`,
		calendarDates: sql`(SELECT MAX(${calendarDates.feed_version}) FROM calendar_dates WHERE ${calendarDates.operator} = ${operator})`,
		shapes: sql`(SELECT MAX(${shapes.feed_version}) FROM shapes WHERE ${shapes.operator} = ${operator})`,
	};
}
