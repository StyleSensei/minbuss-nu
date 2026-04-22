import { put } from "@vercel/blob";
import { extractZip } from "../cron/dataProcessors/extractZip";
import { saveToDatabase } from "../cron/dataProcessors/saveToDatabase";
import { revalidateFeedCache } from "./revalidateFeedCache";
import { getConfiguredOperators } from "../shared/config/gtfsOperators";

const delayMs = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function updateGTFSData() {
	try {
		console.log("Starting GTFS data update...");
		const operators = getConfiguredOperators();

		for (let i = 0; i < operators.length; i++) {
			const operator = operators[i];
			if (i > 0) {
				const raw = process.env.GTFS_IMPORT_DELAY_MS?.trim();
				const parsed = raw !== undefined && raw !== "" ? Number(raw) : NaN;
				const ms = Number.isFinite(parsed)
					? Math.max(0, parsed)
					: operators.length > 1
						? 7000
						: 0;
				if (ms > 0) {
					console.log(`Waiting ${ms}ms before next operator (rate limits)...`);
					await delayMs(ms);
				}
			}
			console.log(`Starting GTFS update for operator: ${operator}`);
			const { routes, trips, stops, stopTimes, calendarDates, shapes } =
				await extractZip(operator);

			console.log("Saving routes to database...");
			await saveToDatabase(routes, "routes", operator);

			console.log("Saving trips to database...");
			await saveToDatabase(trips, "trips", operator);

			console.log("Saving shapes to database...");
			await saveToDatabase(shapes, "shapes", operator);

			console.log("Saving stops to database...");
			await saveToDatabase(stops, "stops", operator);

			console.log("Saving stop times to database...");
			await saveToDatabase(stopTimes, "stop_times", operator);

			console.log("Saving calendar dates to database...");
			await saveToDatabase(calendarDates, "calendar_dates", operator);
		}

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
