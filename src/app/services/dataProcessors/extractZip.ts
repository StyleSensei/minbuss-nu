import type { Readable } from "node:stream";
import { getStaticData } from "../dataSources/gtfsStatic";
const unzipper = require("unzipper");
import csvParser from "csv-parser";
import type { IRoute } from "@/app/models/IRoute";
import type { ITrip } from "@/app/models/ITrip";
import type { IStop } from "@/app/models/IStop";
import type { IStopTime } from "@/app/models/IStopTime";

export const extractZip = async () => {
	const routes: IRoute[] = [];
	const trips: ITrip[] = [];
	const stops: IStop[] = [];
	const stopTimes: IStopTime[] = [];

	const zip: Readable = (await getStaticData()).pipe(
		unzipper.Parse({ forceStream: true }),
	);

	for await (const entry of zip) {
		const fileName = entry.path;
		if (
			fileName === "routes.txt" ||
			fileName === "trips.txt" ||
			fileName === "stops.txt" ||
			fileName === "stop_times.txt"
		) {
			entry
				.pipe(csvParser())
				.on("data", (data: IRoute | ITrip | IStop | IStopTime) => {
					switch (fileName) {
						case "routes.txt":
							routes.push(data as IRoute);
							break;
						case "stops.txt":
							stops.push(data as IStop);
							break;
						case "stop_times.txt":
							stopTimes.push(data as IStopTime);
							break;
						default:
							trips.push(data as ITrip);
							break;
					}
				})
				.on("end", () => {
					console.log("CSV parsing completed for: ", fileName);
				})
				.on("error", (error: Error) => {
					console.error("Error parsing CSV for: ", fileName, error);
				});
		} else {
			console.log("Skipping file: ", fileName);
			entry.autodrain();
		}
	}

	return { routes, trips, stops, stopTimes };
};
