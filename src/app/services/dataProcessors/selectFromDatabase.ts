import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { trips } from "@/app/db/schema/trips";
import { routes } from "@/app/db/schema/routes";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

export const selectFromDatabase = async (busLine: string) => {
	try {
		const data = await db
			.select({
				trip_id: trips.trip_id,
				route_id: routes.route_id,
				route_short_name: routes.route_id,
			})
			.from(trips)
			.leftJoin(routes, eq(trips.route_id, routes.route_id))
			.where(eq(routes.route_short_name, busLine));
		// console.log(data);
		return data;
	} catch (error) {
		console.log(error);
		return [];
	}
};
