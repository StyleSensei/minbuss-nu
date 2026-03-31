/**
 * Ensures performance indexes used by nearby/search stops APIs.
 * Requires DATABASE_URL (e.g. in .env.local). Run: npm run db:ensure-indexes
 */
import { config } from "dotenv";
import postgres from "postgres";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const INDEX_STATEMENTS = [
	`CREATE INDEX IF NOT EXISTS idx_stops_feed_lat_lon ON stops (feed_version, stop_lat, stop_lon)`,
	`CREATE INDEX IF NOT EXISTS idx_stop_times_feed_stop_trip ON stop_times (feed_version, stop_id, trip_id)`,
	`CREATE INDEX IF NOT EXISTS idx_stop_times_trip_feed ON stop_times (trip_id, feed_version)`,
	`CREATE INDEX IF NOT EXISTS idx_trips_feed_trip_route ON trips (feed_version, trip_id, route_id)`,
	`CREATE INDEX IF NOT EXISTS idx_routes_feed_route_short ON routes (feed_version, route_id, route_short_name)`,
];

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}

	const sql = postgres(process.env.DATABASE_URL);
	try {
		for (const statement of INDEX_STATEMENTS) {
			await sql.unsafe(statement);
		}
		console.log(`Ensured ${INDEX_STATEMENTS.length} indexes`);
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
