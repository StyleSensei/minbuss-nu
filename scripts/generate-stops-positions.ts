/**
 * Generates public/stops-positions.json from the database (latest GTFS feed).
 * Requires DATABASE_URL (e.g. in .env.local). Run: pnpm generate:stops
 */
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
	const { initDb } = await import("../src/app/services/dataProcessors/db");
	initDb();

	const {
		selectAllStopPositionsFromDatabase,
		selectLatestFeedVersionFromDatabase,
	} = await import(
		"../src/app/services/dataProcessors/stopPositionsStaticQueries"
	);

	const [stops, v] = await Promise.all([
		selectAllStopPositionsFromDatabase(),
		selectLatestFeedVersionFromDatabase(),
	]);

	const payload = {
		v: v ?? "0",
		stops,
	};

	const outPath = join(process.cwd(), "public", "stops-positions.json");
	await writeFile(outPath, `${JSON.stringify(payload)}\n`, "utf8");
	console.log(
		`Wrote ${stops.length} stops to ${outPath} (feed v=${payload.v})`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
