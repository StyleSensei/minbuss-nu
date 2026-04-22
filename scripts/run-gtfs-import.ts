/**
 * Hämtar statisk GTFS Regional per operatör (enligt GTFS_OPERATORS) och sparar till databasen.
 * Kräver DATABASE_URL, GTFS_REGIONAL_STATIC, BLOB_READ_WRITE_TOKEN (samma som cron).
 * Laddar .env.local / .env innan cron-moduler läses in.
 *
 * Kör: npm run db:import-gtfs
 *
 * Rekommenderat innan första körning: npm run db:populate-gtfs
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
	const { updateGTFSData } = await import("../src/cron/updateGTFS");
	await updateGTFSData();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
