/**
 * Adds operator columns to GTFS tables, backfills existing data to "sl",
 * and enforces NOT NULL so multi-operator upserts can run safely.
 *
 * Run: npm run db:prepare-operators
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const ALTER_STATEMENTS = [
	`ALTER TABLE routes ADD COLUMN IF NOT EXISTS operator varchar`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS operator varchar`,
	`ALTER TABLE stops ADD COLUMN IF NOT EXISTS operator varchar`,
	`ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS operator varchar`,
	`ALTER TABLE calendar_dates ADD COLUMN IF NOT EXISTS operator varchar`,
	`ALTER TABLE shapes ADD COLUMN IF NOT EXISTS operator varchar`,
];

const BACKFILL_STATEMENTS = [
	`UPDATE routes SET operator = 'sl' WHERE operator IS NULL`,
	`UPDATE trips SET operator = 'sl' WHERE operator IS NULL`,
	`UPDATE stops SET operator = 'sl' WHERE operator IS NULL`,
	`UPDATE stop_times SET operator = 'sl' WHERE operator IS NULL`,
	`UPDATE calendar_dates SET operator = 'sl' WHERE operator IS NULL`,
	`UPDATE shapes SET operator = 'sl' WHERE operator IS NULL`,
];

const NOT_NULL_STATEMENTS = [
	`ALTER TABLE routes ALTER COLUMN operator SET NOT NULL`,
	`ALTER TABLE trips ALTER COLUMN operator SET NOT NULL`,
	`ALTER TABLE stops ALTER COLUMN operator SET NOT NULL`,
	`ALTER TABLE stop_times ALTER COLUMN operator SET NOT NULL`,
	`ALTER TABLE calendar_dates ALTER COLUMN operator SET NOT NULL`,
	`ALTER TABLE shapes ALTER COLUMN operator SET NOT NULL`,
];

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}

	const sql = postgres(process.env.DATABASE_URL);
	try {
		for (const statement of ALTER_STATEMENTS) {
			await sql.unsafe(statement);
		}
		for (const statement of BACKFILL_STATEMENTS) {
			await sql.unsafe(statement);
		}
		for (const statement of NOT_NULL_STATEMENTS) {
			await sql.unsafe(statement);
		}
		console.log("Prepared operator columns for GTFS tables");
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
