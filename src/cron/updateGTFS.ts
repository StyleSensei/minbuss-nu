import { put } from "@vercel/blob";
import { processOperatorGtfs } from "../cron/dataProcessors/processOperatorGtfs";
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
			await processOperatorGtfs(operator);
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
