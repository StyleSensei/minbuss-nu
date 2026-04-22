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
	`CREATE INDEX IF NOT EXISTS idx_stops_operator_feed_lat_lon ON stops (operator, feed_version, stop_lat, stop_lon)`,
	`CREATE INDEX IF NOT EXISTS idx_stop_times_operator_feed_stop_trip ON stop_times (operator, feed_version, stop_id, trip_id)`,
	`CREATE INDEX IF NOT EXISTS idx_stop_times_operator_trip_feed ON stop_times (operator, trip_id, feed_version)`,
	`CREATE INDEX IF NOT EXISTS idx_trips_operator_feed_trip_route ON trips (operator, feed_version, trip_id, route_id)`,
	`CREATE INDEX IF NOT EXISTS idx_routes_operator_feed_route_short ON routes (operator, feed_version, route_id, route_short_name)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_routes_operator_route_id ON routes (operator, route_id)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_operator_trip_id ON trips (operator, trip_id)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_stops_operator_stop_id ON stops (operator, stop_id)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_dates_operator_service_date ON calendar_dates (operator, service_id, date)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_stop_times_operator_trip_seq_stop ON stop_times (operator, trip_id, stop_sequence, stop_id)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_shapes_operator_shape_seq ON shapes (operator, shape_id, shape_pt_sequence)`,
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
