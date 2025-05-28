import { extractZip } from "../dist-cron/src/shared/services/dataProcessors/extractZip.js";
import { saveToDatabase } from "../dist-cron/src/shared/services/dataProcessors/saveToDatabase.js";

async function main() {
	try {
		console.log("Starting GTFS data update...");
		const { routes, trips, stops, stopTimes } = await extractZip();

		console.log("Saving routes to database...");
		await saveToDatabase(routes, "routes");

		console.log("Saving trips to database...");
		await saveToDatabase(trips, "trips");

		console.log("Saving stops to database...");
		await saveToDatabase(stops, "stops");

		console.log("Saving stop times to database...");
		await saveToDatabase(stopTimes, "stop_times");

		console.log("GTFS data update completed successfully!");
		process.exit(0);
	} catch (error) {
		console.error("Error updating GTFS data:", error);
		process.exit(1);
	}
}

main();
