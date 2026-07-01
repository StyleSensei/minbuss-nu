import type { Readable } from "node:stream";
import { getStaticData } from "../dataSources/gtfsStatic";
import unzipper from "unzipper";
import type { IRoute } from "../../shared/models/IRoute";
import type { ITrip } from "../../shared/models/ITrip";
import type { IStop } from "../../shared/models/IStop";
import type { IStopTime } from "../../shared/models/IStopTime";
import type { ICalendarDates } from "../../shared/models/ICalendarDates";
import type { IShapes } from "../../shared/models/IShapes";
import { parseEntryAsArray } from "./parseZipEntry";
import {
	transformCalendarDates,
	transformRoutes,
	transformShapes,
	transformStops,
	transformStopTimes,
	transformTrips,
} from "./gtfsTransforms";

const GTFS_TXT_FILES = [
	"routes.txt",
	"trips.txt",
	"stops.txt",
	"stop_times.txt",
	"calendar_dates.txt",
	"shapes.txt",
] as const;

export type ExtractZipOptions = {
	/** Om satt parsas bara dessa filer ur zip (t.ex. bara `["shapes.txt"]`). */
	onlyFiles?: readonly string[];
};

export const extractZip = async (
	operator: string,
	options?: ExtractZipOptions,
) => {
	const allowed = new Set<string>(
		options?.onlyFiles?.length ? options.onlyFiles : [...GTFS_TXT_FILES],
	);
	const routes: IRoute[] = [];
	const trips: ITrip[] = [];
	const stops: IStop[] = [];
	const stopTimes: IStopTime[] = [];
	const calendarDates: ICalendarDates[] = [];
	const shapes: IShapes[] = [];

	const zip: Readable = (await getStaticData(operator)).pipe(
		unzipper.Parse({ forceStream: true }),
	);

	for await (const entry of zip) {
		const fileName = entry.path;
		if (!allowed.has(fileName)) {
			entry.autodrain();
			continue;
		}

		const rows = await parseEntryAsArray(entry);
		console.log("CSV parsing completed for: ", fileName);

		switch (fileName) {
			case "routes.txt":
				routes.push(...transformRoutes(rows, operator));
				break;
			case "stops.txt":
				stops.push(...transformStops(rows, operator));
				break;
			case "stop_times.txt":
				stopTimes.push(...transformStopTimes(rows, operator));
				break;
			case "calendar_dates.txt":
				calendarDates.push(...transformCalendarDates(rows, operator));
				break;
			case "shapes.txt":
				shapes.push(...transformShapes(rows, operator));
				break;
			default:
				trips.push(...transformTrips(rows, operator));
				break;
		}
	}

	return {
		routes,
		trips,
		stops,
		stopTimes,
		calendarDates,
		shapes,
	};
};
