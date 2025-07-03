import type { Readable } from "node:stream";
import { getStaticData } from "../dataSources/gtfsStatic";
import unzipper from "unzipper";
import csvParser from "csv-parser";
import type { IRoute } from "../../models/IRoute";
import type { ITrip } from "../../models/ITrip";
import type { IStop } from "../../models/IStop";
import type { IStopTime } from "../../models/IStopTime";
import type { ICalendar } from "../../models/ICalendar";
import type { ICalendarDates } from "../../models/ICalendarDates";

function normalizeStopTime(stopTime: IStopTime): IStopTime {
	return {
		...stopTime,
		shape_dist_traveled:
			stopTime.shape_dist_traveled === "" ? null : stopTime.shape_dist_traveled,
	};
}

export const extractZip = async () => {
	const routes: IRoute[] = [];
	const trips: ITrip[] = [];
	const stops: IStop[] = [];
	const stopTimes: IStopTime[] = [];
	const calendar: ICalendar[] = [];
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
								stopTimes.push(normalizeStopTime(data as IStopTime));
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

	return { routes, trips, stops, stopTimes, calendarDates };
};
