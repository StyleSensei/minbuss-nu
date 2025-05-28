import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { trips } from "@shared/db/schema/trips";
import { routes } from "@shared/db/schema/routes";
import { eq, inArray, and, desc } from "drizzle-orm";
import { stop_times } from "@shared/db/schema/stop_times";
import { stops } from "@shared/db/schema/stops";
import type { IDbData } from "@shared/models/IDbData";
import { getCurrentTripIds } from "@/app/actions/getCurrentTripIds";
import { selectAllSchema } from "@shared/db/schema/selectAll";
import { z } from "zod";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

export const selectFromDatabase = async (busLine: string) => {
	MetricsTracker.trackDbQuery();
	const { filteredTripIds } = await getCurrentTripIds();

	try {
		const data = await db
			.select({
				trip_id: trips.trip_id,
				route_id: routes.route_id,
				route_short_name: routes.route_short_name,
				stop_headsign: stop_times.stop_headsign,
				arrival_time: stop_times.arrival_time,
				stop_name: stops.stop_name,
				stop_sequence: stop_times.stop_sequence,
				stop_id: stops.stop_id,
				stop_lat: stops.stop_lat,
				stop_lon: stops.stop_lon,
			})
			.from(trips)
			.leftJoin(routes, eq(trips.route_id, routes.route_id))
			.leftJoin(stop_times, eq(trips.trip_id, stop_times.trip_id))
			.leftJoin(stops, eq(stop_times.stop_id, stops.stop_id))
			.where(
				and(
					eq(routes.route_short_name, busLine),
					inArray(trips.trip_id, filteredTripIds),
				),
			)
			.orderBy(desc(trips.trip_id), desc(stop_times.arrival_time));
		const parsed = z.array(selectAllSchema).parse(data) as IDbData[];

		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};
