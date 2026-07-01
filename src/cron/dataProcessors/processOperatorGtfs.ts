import type { Readable } from "node:stream";
import unzipper from "unzipper";
import { getStaticData } from "../dataSources/gtfsStatic";
import { parseEntryAsArray, parseEntryInBatches } from "./parseZipEntry";
import {
	transformCalendarDates,
	transformRoutes,
	transformShapes,
	transformStops,
	transformStopTimes,
	transformTrips,
} from "./gtfsTransforms";
import { saveToDatabase } from "./saveToDatabase";

const STREAMING_BATCH_SIZE = 8000;

const GTFS_FILE_ORDER = [
	"routes.txt",
	"trips.txt",
	"shapes.txt",
	"stops.txt",
	"stop_times.txt",
	"calendar_dates.txt",
] as const;

const STREAMING_FILES = new Set<string>(["stop_times.txt", "shapes.txt"]);

export async function processOperatorGtfs(operator: string): Promise<void> {
	const zip: Readable = (await getStaticData(operator)).pipe(
		unzipper.Parse({ forceStream: true }),
	);

	const pendingFiles = new Set<string>(GTFS_FILE_ORDER);

	for await (const entry of zip) {
		const fileName = entry.path;

		if (!pendingFiles.has(fileName)) {
			entry.autodrain();
			continue;
		}

		console.log(`Processing ${fileName}...`);
		pendingFiles.delete(fileName);

		if (STREAMING_FILES.has(fileName)) {
			let batchNumber = 0;
			await parseEntryInBatches(entry, STREAMING_BATCH_SIZE, async (rows) => {
				batchNumber += 1;
				if (fileName === "stop_times.txt") {
					const stopTimes = transformStopTimes(rows, operator);
					await saveToDatabase(stopTimes, "stop_times", operator);
					console.log(
						`  Saved stop_times batch ${batchNumber} (${rows.length} rows)`,
					);
				} else {
					const shapes = transformShapes(rows, operator);
					await saveToDatabase(shapes, "shapes", operator);
					console.log(
						`  Saved shapes batch ${batchNumber} (${rows.length} rows)`,
					);
				}
			});
		} else {
			const rows = await parseEntryAsArray(entry);

			switch (fileName) {
				case "routes.txt":
					await saveToDatabase(
						transformRoutes(rows, operator),
						"routes",
						operator,
					);
					break;
				case "trips.txt":
					await saveToDatabase(transformTrips(rows, operator), "trips", operator);
					break;
				case "stops.txt":
					await saveToDatabase(transformStops(rows, operator), "stops", operator);
					break;
				case "calendar_dates.txt":
					await saveToDatabase(
						transformCalendarDates(rows, operator),
						"calendar_dates",
						operator,
					);
					break;
			}

			console.log(`  Saved ${rows.length} rows from ${fileName}`);
		}
	}

	if (pendingFiles.size > 0) {
		console.warn(
			`Zip for ${operator} was missing: ${[...pendingFiles].join(", ")}`,
		);
	}
}
