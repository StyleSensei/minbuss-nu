import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
	calendarDates,
	calendarDatesInsertSchemaArray,
} from "../../shared/db/schema/calendar_dates";
import { routes, routesInsertSchemaArray } from "../../shared/db/schema/routes";
import { shapes, shapesInsertSchemaArray } from "../../shared/db/schema/shapes";
import {
	stop_times,
	stopTimesInsertSchemaArray,
} from "../../shared/db/schema/stop_times";
import { stops, stopsInsertSchemaArray } from "../../shared/db/schema/stops";
import { trips, tripsInsertSchemaArray } from "../../shared/db/schema/trips";
import type { ICalendarDates } from "../../shared/models/ICalendarDates";
import type { IRoute } from "../../shared/models/IRoute";
import type { IShapes } from "../../shared/models/IShapes";
import type { IStop } from "../../shared/models/IStop";
import type { IStopTime } from "../../shared/models/IStopTime";
import type { ITrip } from "../../shared/models/ITrip";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle(queryClient);

const calculateBatchSize = (columns: number) => {
	const maxParameters = 65534;
	return Math.floor((maxParameters / columns) * 0.8); // 80% of maxParameters for extra margin
};

const checkTripIdsExist = async (tripIds: string[], operator: string) => {
	const existingTripIds = await db
		.select({ trip_id: trips.trip_id })
		.from(trips)
		.where(and(eq(trips.operator, operator), inArray(trips.trip_id, tripIds)));
	const existingTripIdsSet = new Set(
		existingTripIds.map((trip) => trip.trip_id),
	);
	return tripIds.every((tripId) => existingTripIdsSet.has(tripId));
};

export const saveToDatabase = async (
	data:
		| IRoute[]
		| ITrip[]
		| IStop[]
		| IStopTime[]
		| ICalendarDates[]
		| IShapes[],
	table: string,
	operator: string,
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
				await db
					.insert(routes)
					.values(routesBatchParsed)
					.onConflictDoUpdate({
						target: [routes.operator, routes.route_id],
						set: {
							route_short_name: sql`excluded.route_short_name`,
							route_long_name: sql`excluded.route_long_name`,
							route_desc: sql`excluded.route_desc`,
							route_type: sql`excluded.route_type`,
							agency_id: sql`excluded.agency_id`,
							operator: sql`excluded.operator`,
							feed_version: sql`CURRENT_DATE`,
						},
					});
				console.log(
					`Updated batch ${i + 1} of ${totalBatches} for routes in database`,
				);
				break;
			}
			case "trips": {
				const tripsBatch = batch as ITrip[];
				const tripsBatchParsed = tripsInsertSchemaArray.parse(tripsBatch);
				await db
					.insert(trips)
					.values(tripsBatchParsed)
					.onConflictDoUpdate({
						target: [trips.operator, trips.trip_id],
						set: {
							route_id: sql`excluded.route_id`,
							service_id: sql`excluded.service_id`,
							trip_headsign: sql`excluded.trip_headsign`,
							direction_id: sql`excluded.direction_id`,
							shape_id: sql`excluded.shape_id`,
							operator: sql`excluded.operator`,
							feed_version: sql`CURRENT_DATE`,
						},
					});
				console.log(
					`Updated batch ${i + 1} of ${totalBatches} for trips in database`,
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
					.onConflictDoUpdate({
						target: [
							calendarDates.operator,
							calendarDates.service_id,
							calendarDates.date,
						],
						set: {
							exception_type: sql`excluded.exception_type`,
							operator: sql`excluded.operator`,
							feed_version: sql`CURRENT_DATE`,
						},
					});
				console.log(
					`Updated batch ${i + 1} of ${totalBatches} for calendar_dates in database`,
				);
				break;
			}

			case "stops": {
				const stopsBatch = batch as IStop[];
				const stopsBatchParsed = stopsInsertSchemaArray.parse(stopsBatch);
				await db
					.insert(stops)
					.values(stopsBatchParsed)
					.onConflictDoUpdate({
						target: [stops.operator, stops.stop_id],
						set: {
							stop_name: sql`excluded.stop_name`,
							stop_lat: sql`excluded.stop_lat`,
							stop_lon: sql`excluded.stop_lon`,
							location_type: sql`excluded.location_type`,
							parent_station: sql`excluded.parent_station`,
							platform_code: sql`excluded.platform_code`,
							operator: sql`excluded.operator`,
							feed_version: sql`CURRENT_DATE`,
						},
					});
				console.log(
					`Updated batch ${i + 1} of ${totalBatches} for stops in database`,
				);
				break;
			}
			case "stop_times": {
				const stopTimesBatch = batch as IStopTime[];
				const tripIds = stopTimesBatch.map((stopTime) => stopTime.trip_id);
				const tripIdsExist = await checkTripIdsExist(tripIds, operator);
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
					.onConflictDoUpdate({
						target: [
							stop_times.operator,
							stop_times.trip_id,
							stop_times.stop_sequence,
							stop_times.stop_id,
						],
						set: {
							arrival_time: sql`excluded.arrival_time`,
							departure_time: sql`excluded.departure_time`,
							stop_headsign: sql`excluded.stop_headsign`,
							pickup_type: sql`excluded.pickup_type`,
							drop_off_type: sql`excluded.drop_off_type`,
							shape_dist_traveled: sql`excluded.shape_dist_traveled`,
							timepoint: sql`excluded.timepoint`,
							operator: sql`excluded.operator`,
							feed_version: sql`CURRENT_DATE`,
						},
					});
				console.log(
					`Updated batch ${i + 1} of ${totalBatches} for stop_times in database`,
				);
				break;
			}

			case "shapes": {
				const shapesBatch = batch as IShapes[];
				/** drizzle insert för numeric() förväntar sträng; extractZip ger number. */
				const rowsForSchema = shapesBatch.map((row) => ({
					operator: row.operator ?? operator,
					shape_id: row.shape_id,
					shape_pt_lat: String(row.shape_pt_lat),
					shape_pt_lon: String(row.shape_pt_lon),
					shape_pt_sequence: row.shape_pt_sequence,
					shape_dist_traveled:
						row.shape_dist_traveled === undefined ||
						row.shape_dist_traveled === null
							? undefined
							: String(row.shape_dist_traveled),
				}));
				const shapesBatchParsed =
					shapesInsertSchemaArray.parse(rowsForSchema);
				await db
					.insert(shapes)
					.values(
						shapesBatchParsed.map((row) => ({
							...row,
							feed_version: sql`CURRENT_DATE`,
						})),
					)
					.onConflictDoUpdate({
						target: [shapes.operator, shapes.shape_id, shapes.shape_pt_sequence],
						set: {
							shape_pt_lat: sql`excluded.shape_pt_lat`,
							shape_pt_lon: sql`excluded.shape_pt_lon`,
							shape_dist_traveled: sql`excluded.shape_dist_traveled`,
							operator: sql`excluded.operator`,
							feed_version: sql`CURRENT_DATE`,
						},
					});
				console.log(
					`Updated batch ${i + 1} of ${totalBatches} for shapes in database`,
				);
				break;
			}

			default:
				console.log("Unknown data type");
		}
	}
};
