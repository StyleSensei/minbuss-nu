import { extractZip } from "../shared/services/dataProcessors/extractZip";
import { saveToDatabase } from "../shared/services/dataProcessors/saveToDatabase";

export async function updateGTFSData() {
	try {
		console.log("Starting GTFS data update...");
		const { routes, trips, stops, stopTimes, calendarDates } =
			await extractZip();

		console.log("Saving routes to database...");
		await saveToDatabase(routes, "routes");

		console.log("Saving trips to database...");
		await saveToDatabase(trips, "trips");

		console.log("Saving stops to database...");
		await saveToDatabase(stops, "stops");

		console.log("Saving stop times to database...");
		await saveToDatabase(stopTimes, "stop_times");

		console.log("Saving calendar dates to database...");
		await saveToDatabase(calendarDates, "calendar_dates");

		console.log("GTFS data update completed successfully!");
	} catch (error) {
		console.error("Error updating GTFS data:", error);
		throw error;
	}
}
