import { routes, routesInsertSchemaArray } from "../../shared/db/schema/routes";
import {
	stop_times,
	stopTimesInsertSchemaArray,
} from "../../shared/db/schema/stop_times";
import { stops, stopsInsertSchemaArray } from "../../shared/db/schema/stops";
import { trips, tripsInsertSchemaArray } from "../../shared/db/schema/trips";
import type { IRoute } from "../../shared/models/IRoute";
import type { ITrip } from "../../shared/models/ITrip";
import type { IStop } from "../../shared/models/IStop";
import type { IStopTime } from "../../shared/models/IStopTime";
import type { ICalendarDates } from "../../shared/models/ICalendarDates";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
	calendarDates,
	calendarDatesInsertSchemaArray,
} from "../../shared/db/schema/calendar_dates";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle(queryClient);

const calculateBatchSize = (columns: number) => {
	const maxParameters = 65534;
	return Math.floor((maxParameters / columns) * 0.8); // 80% of maxParameters for extra margin
};

const checkTripIdsExist = async (tripIds: string[]) => {
	const existingTripIds = await db
		.select({ trip_id: trips.trip_id })
		.from(trips)
		.where(inArray(trips.trip_id, tripIds));
	const existingTripIdsSet = new Set(
		existingTripIds.map((trip) => trip.trip_id),
	);
	return tripIds.every((tripId) => existingTripIdsSet.has(tripId));
};

export const saveToDatabase = async (
	data: IRoute[] | ITrip[] | IStop[] | IStopTime[] | ICalendarDates[],
	table: string,
) => {
	let batchSize = 10000;
	if (data.length > 0) {
		const columns = Object.keys(data[0]).length;
		batchSize = calculateBatchSize(columns);
	}
	const totalBatches = Math.ceil(data.length / batchSize);
	for (let i = 0; i < totalBatches; i++) {
		const batch = data.slice(i * batchSize, (i + 1) * batchSize);
		switch (table) {
			case "routes": {
				const routesBatch = batch as IRoute[];
				const routesBatchParsed = routesInsertSchemaArray.parse(routesBatch);
				await db.insert(routes).values(routesBatchParsed).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from routes to database`,
				);
				break;
			}
			case "trips": {
				const tripsBatch = batch as ITrip[];
				const tripsBatchParsed = tripsInsertSchemaArray.parse(tripsBatch);
				await db.insert(trips).values(tripsBatchParsed).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from trips to database`,
				);
				break;
			}

			case "calendar_dates": {
				const calendarDatesBatch = batch as ICalendarDates[];
				const calendarDatesBatchParsed =
					calendarDatesInsertSchemaArray.parse(calendarDatesBatch);
				await db
					.insert(calendarDates)
					.values(calendarDatesBatchParsed)
					.onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from calendar_dates to database`,
				);
				break;
			}

			case "stops": {
				const stopsBatch = batch as IStop[];
				const stopsBatchParsed = stopsInsertSchemaArray.parse(stopsBatch);
				await db.insert(stops).values(stopsBatchParsed).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from stops to database`,
				);
				break;
			}
			case "stop_times": {
				const stopTimesBatch = batch as IStopTime[];
				const tripIds = stopTimesBatch.map((stopTime) => stopTime.trip_id);
				const tripIdsExist = await checkTripIdsExist(tripIds);
				if (!tripIdsExist) {
					console.error(
						`Error: Some trip_ids in batch ${i + 1} do not exist in the trips table`,
					);
					break;
				}
				const stopTimesBatchParsed =
					stopTimesInsertSchemaArray.parse(stopTimesBatch);
				await db
					.insert(stop_times)
					.values(stopTimesBatchParsed)
					.onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from stop_times to database`,
				);
				break;
			}

			default:
				console.log("Unknown data type");
		}
	}
};
