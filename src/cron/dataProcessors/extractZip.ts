import type { Readable } from "node:stream";
import { getStaticData } from "../dataSources/gtfsStatic";
import unzipper from "unzipper";
import csvParser from "csv-parser";
import type { IRoute } from "../../shared/models/IRoute";
import type { ITrip } from "../../shared/models/ITrip";
import type { IStop } from "../../shared/models/IStop";
import type { IStopTime } from "../../shared/models/IStopTime";
import type { ICalendarDates } from "../../shared/models/ICalendarDates";
import type { IShapes } from "../../shared/models/IShapes";

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
		options?.onlyFiles?.length
			? options.onlyFiles
			: [...GTFS_TXT_FILES],
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
		if (allowed.has(fileName)) {
			entry
				.pipe(csvParser())
				.on(
					"data",
					(data: IRoute | ITrip | IStop | IStopTime | ICalendarDates | IShapes) => {
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
							case "calendar_dates.txt":
								calendarDates.push(data as ICalendarDates);
								break;
							case "shapes.txt":
								shapes.push(data as IShapes);
								break;
							default:
								trips.push(data as ITrip);
								break;
						}
					},
				)
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

	const routesWithCorrectTypes = routes.map((route) => ({
		...route,
		operator,
		route_type: Number(route.route_type),
	}));

	const tripsWithCorrectTypes = trips.map((trip) => ({
		...trip,
		operator,
		service_id: Number(trip.service_id),
		direction_id: Number(trip.direction_id),
	}));

	const stopsWithCorrectTypes = stops.map((stop) => ({
		...stop,
		operator,
		stop_lat: Number(stop.stop_lat),
		stop_lon: Number(stop.stop_lon),
		location_type: Number(stop.location_type),
	}));

	const stopTimesWithCorrectTypes = stopTimes.map((stopTime) => ({
		...stopTime,
		operator,
		stop_sequence: Number(stopTime.stop_sequence),
		pickup_type: Number(stopTime.pickup_type),
		drop_off_type: Number(stopTime.drop_off_type),
		shape_dist_traveled:
			stopTime.shape_dist_traveled === ""
				? "0"
				: String(stopTime.shape_dist_traveled),
		timepoint: Number(stopTime.timepoint),
	}));

	const calendarDatesWithCorrectTypes = calendarDates.map((date) => ({
		...date,
		operator,
		service_id: Number(date.service_id),
		exception_type: Number(date.exception_type),
	}));

	const shapesWithCorrectTypes = shapes.map((shape) => {
		const rawDist = shape.shape_dist_traveled as unknown;
		const distMissing =
			rawDist === "" ||
			rawDist === null ||
			rawDist === undefined ||
			(typeof rawDist === "string" && rawDist.trim() === "");
		const distNum = distMissing ? Number.NaN : Number(rawDist);
		const shape_dist_traveled =
			distMissing || Number.isNaN(distNum) ? undefined : distNum;

		return {
			...shape,
			operator,
			shape_pt_lat: Number(shape.shape_pt_lat),
			shape_pt_lon: Number(shape.shape_pt_lon),
			shape_pt_sequence: Number(shape.shape_pt_sequence),
			shape_dist_traveled,
		};
	});

	return {
		routes: routesWithCorrectTypes,
		trips: tripsWithCorrectTypes,
		stops: stopsWithCorrectTypes,
		stopTimes: stopTimesWithCorrectTypes,
		calendarDates: calendarDatesWithCorrectTypes,
		shapes: shapesWithCorrectTypes,
	};
};
