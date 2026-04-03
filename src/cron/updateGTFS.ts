import { put } from "@vercel/blob";
import { extractZip } from "../cron/dataProcessors/extractZip";
import { saveToDatabase } from "../cron/dataProcessors/saveToDatabase";
import { revalidateFeedCache } from "./revalidateFeedCache";

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

		const feedVersion = new Date().toISOString().split("T")[0];
		console.log(`Saving feed version ${feedVersion} to blob storage...`);
		await put("feed-version.json", JSON.stringify({ feedVersion }), {
			access: "private",
			token: process.env.BLOB_READ_WRITE_TOKEN,
			allowOverwrite: true,
		});

		console.log("Revalidating feed API cache...");
		await revalidateFeedCache();

		console.log("GTFS data update completed successfully!");
	} catch (error) {
		console.error("Error updating GTFS data:", error);
		throw error;
	}
}
