import type { Readable } from "node:stream";
import { getStaticData } from "../dataSources/gtfsStatic";
const unzipper = require("unzipper");
import csvParser from "csv-parser";

export interface IRoute {
	route_id: string;
	agency_id: string;
	route_short_name: string;
	route_long_name: string;
	route_type: number;
	route_desc: string;
}
export interface ITrip {
	route_id: string;
	service_id: string;
	trip_id: string;
	trip_headsign: string;
	direction_id: number;
	shape_id: string;
}

export const extractZip = async () => {
	const routes: IRoute[] = [];
	const trips: ITrip[] = [];

	const zip: Readable = (await getStaticData()).pipe(
		unzipper.Parse({ forceStream: true }),
	);

	for await (const entry of zip) {
		const fileName = entry.path;
		if (fileName === "routes.txt" || fileName === "trips.txt") {
			entry
				.pipe(csvParser())
				.on("data", (data: IRoute | ITrip) => {
					if (fileName === "routes.txt") routes.push(data as IRoute);
					else trips.push(data as ITrip);
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

	return { routes, trips };
};
