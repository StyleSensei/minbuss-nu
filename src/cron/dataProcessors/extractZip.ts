import type { Readable } from "node:stream";
import { getStaticData } from "../dataSources/gtfsStatic";
import unzipper from "unzipper";
import csvParser from "csv-parser";
import type { IRoute } from "../../shared/models/IRoute";
import type { ITrip } from "../../shared/models/ITrip";
import type { IStop } from "../../shared/models/IStop";
import type { IStopTime } from "../../shared/models/IStopTime";
import type { ICalendarDates } from "../../shared/models/ICalendarDates";

export const extractZip = async () => {
	const routes: IRoute[] = [];
	const trips: ITrip[] = [];
	const stops: IStop[] = [];
	const stopTimes: IStopTime[] = [];
	const calendarDates: ICalendarDates[] = [];

	const zip: Readable = (await getStaticData()).pipe(
		unzipper.Parse({ forceStream: true }),
	);

	for await (const entry of zip) {
		const fileName = entry.path;
		if (
			fileName === "routes.txt" ||
			fileName === "trips.txt" ||
			fileName === "stops.txt" ||
			fileName === "stop_times.txt" ||
			fileName === "calendar_dates.txt"
		) {
			entry
				.pipe(csvParser())
				.on(
					"data",
					(data: IRoute | ITrip | IStop | IStopTime | ICalendarDates) => {
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
		route_type: Number(route.route_type),
	}));

	const tripsWithCorrectTypes = trips.map((trip) => ({
		...trip,
		service_id: Number(trip.service_id),
		direction_id: Number(trip.direction_id),
	}));

	const stopsWithCorrectTypes = stops.map((stop) => ({
		...stop,
		stop_lat: Number(stop.stop_lat),
		stop_lon: Number(stop.stop_lon),
		location_type: Number(stop.location_type),
	}));

	const stopTimesWithCorrectTypes = stopTimes.map((stopTime) => ({
		...stopTime,
		stop_sequence: Number(stopTime.stop_sequence),
		pickup_type: Number(stopTime.pickup_type),
		drop_off_type: Number(stopTime.drop_off_type),
		shape_dist_traveled: Number(stopTime.shape_dist_traveled),
		timepoint: Number(stopTime.timepoint),
	}));

	const calendarDatesWithCorrectTypes = calendarDates.map((date) => ({
		...date,
		service_id: Number(date.service_id),
		exception_type: Number(date.exception_type),
	}));

	return {
		routes: routesWithCorrectTypes,
		trips: tripsWithCorrectTypes,
		stops: stopsWithCorrectTypes,
		stopTimes: stopTimesWithCorrectTypes,
		calendarDates: calendarDatesWithCorrectTypes,
	};
};
