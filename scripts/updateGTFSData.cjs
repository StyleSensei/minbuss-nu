const {
	extractZip,
} = require("../dist/src/app/services/dataProcessors/extractZip");
const {
	saveToDatabase,
} = require("../dist/src/app/services/dataProcessors/saveToDatabase");

async function main() {
	try {
		console.log("Starting GTFS data update...");

		console.time("extractZip");
		console.log("Extracting zip file...");
		const { routes, trips, stops, stopTimes } = await extractZip();
		console.timeEnd("extractZip");

		console.log("Saving routes to database...");
		try {
			await saveToDatabase(routes, "routes");
			console.log("Routes saved successfully");
		} catch (error) {
			console.error("Error saving routes to database:", error);
			throw error;
		}

		console.log("Saving trips to database...");
		try {
			await saveToDatabase(trips, "trips");
			console.log("Trips saved successfully");
		} catch (error) {
			console.error("Error saving trips to database:", error);
			throw error;
		}

		console.log("Saving stops to database...");
		try {
			await saveToDatabase(stops, "stops");
			console.log("Stops saved successfully");
		} catch (error) {
			console.error("Error saving stops to database:", error);
			throw error;
		}

		console.log("Saving stop times to database...");
		try {
			await saveToDatabase(stopTimes, "stop_times");
			console.log("Stop times saved successfully");
		} catch (error) {
			console.error("Error saving stop times to database:", error);
			throw error;
		}

		console.log("GTFS data update completed successfully!");
	} catch (error) {
		console.error("Error updating GTFS data:", error);
		process.exit(1);
	}
}

main();
