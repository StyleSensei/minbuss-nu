import { routes } from "@/app/db/schema/routes";
import { stop_times } from "@/app/db/schema/stop_times";
import { stops } from "@/app/db/schema/stops";
import { trips } from "@/app/db/schema/trips";
import type { IRoute } from "@/app/models/IRoute";
import type { IStop } from "@/app/models/IStop";
import type { IStopTime } from "@/app/models/IStopTime";
import type { ITrip } from "@/app/models/ITrip";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

const batchSize = 10000;

export const saveToDatabase = async (
	data: IRoute[] | ITrip[] | IStop[] | IStopTime[],
	table: string,
) => {
	const totalBatches = Math.ceil(data.length / batchSize);
	for (let i = 0; i < totalBatches; i++) {
		const batch = data.slice(i * batchSize, (i + 1) * batchSize);
		switch (table) {
			case "routes": {
				const routesBatch = batch as IRoute[];
				await db.insert(routes).values(routesBatch).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from routes to database`,
				);
				break;
			}
			case "trips": {
				const tripsBatch = batch as ITrip[];
				await db.insert(trips).values(tripsBatch).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from trips to database`,
				);
				break;
			}
			case "stops": {
				const stopsBatch = batch as IStop[];
				await db.insert(stops).values(stopsBatch).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from stops to database`,
				);
				break;
			}
			case "stop_times": {
				const stopTimesBatch = batch as IStopTime[];
				await db
					.insert(stop_times)
					.values(stopTimesBatch)
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
