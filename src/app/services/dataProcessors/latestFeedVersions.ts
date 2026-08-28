import { calendarDates } from "@shared/db/schema/calendar_dates";
import { routes } from "@shared/db/schema/routes";
import { shapes } from "@shared/db/schema/shapes";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import { trips } from "@shared/db/schema/trips";
import { desc, eq, sql } from "drizzle-orm";
import { redis } from "../../utilities/redis";
import { getDb } from "./db";

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

/** Same horizon as stop-shapes Redis blobs so peek does not re-scan MAX(shapes). */
const FEED_VERSION_TTL_SEC = 24 * 60 * 60;
const FEED_VERSION_TTL_MS = FEED_VERSION_TTL_SEC * 1000;
const feedVersionMemory = new Map<
	string,
	{ trips: string; shapes: string; expires: number }
>();
const feedVersionInflight = new Map<
	string,
	Promise<{ trips: string; shapes: string }>
>();

function redisFeedVersionKey(operator: string) {
	return `feed-versions:v1:${operator}`;
}

function rememberFeedVersions(
	operator: string,
	value: { trips: string; shapes: string },
) {
	feedVersionMemory.set(operator, {
		...value,
		expires: Date.now() + FEED_VERSION_TTL_MS,
	});
}

async function loadLatestFeedVersionTexts(operator: string): Promise<{
	trips: string;
	shapes: string;
}> {
	const cacheKey = redisFeedVersionKey(operator);
	try {
		const cached = await redis.get(cacheKey);
		if (
			cached &&
			typeof cached === "object" &&
			"trips" in cached &&
			"shapes" in cached
		) {
			const value = {
				trips: String((cached as { trips: unknown }).trips ?? ""),
				shapes: String((cached as { shapes: unknown }).shapes ?? ""),
			};
			rememberFeedVersions(operator, value);
			return value;
		}
	} catch {
		// Fall through to Postgres.
	}

	const db = getDb();
	const [tripRow, shapeRow] = await Promise.all([
		db
			.select({ v: sql<string>`${trips.feed_version}::text` })
			.from(trips)
			.where(eq(trips.operator, operator))
			.orderBy(desc(trips.feed_version))
			.limit(1)
			.then((rows) => rows[0]),
		db
			.select({ v: sql<string>`${shapes.feed_version}::text` })
			.from(shapes)
			.where(eq(shapes.operator, operator))
			.orderBy(desc(shapes.feed_version))
			.limit(1)
			.then((rows) => rows[0]),
	]);
	const value = {
		trips: tripRow?.v ?? "",
		shapes: shapeRow?.v ?? "",
	};
	rememberFeedVersions(operator, value);
	try {
		await redis.set(cacheKey, value, { ex: FEED_VERSION_TTL_SEC });
	} catch {
		// Memory cache still avoids repeating the scan in this process.
	}
	return value;
}

/** String values for Redis keys. Do not stringify `latestFeedVersionsByOperator()`. */
export async function selectLatestFeedVersionTexts(operator: string): Promise<{
	trips: string;
	shapes: string;
}> {
	const cached = feedVersionMemory.get(operator);
	if (cached && cached.expires > Date.now()) {
		return { trips: cached.trips, shapes: cached.shapes };
	}

	const pending = feedVersionInflight.get(operator);
	if (pending) return pending;

	const load = loadLatestFeedVersionTexts(operator).finally(() => {
		feedVersionInflight.delete(operator);
	});
	feedVersionInflight.set(operator, load);
	return load;
}
