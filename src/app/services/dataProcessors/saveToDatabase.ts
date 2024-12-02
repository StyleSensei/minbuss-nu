import { routes } from "@/app/db/schema/routes";
import { trips } from "@/app/db/schema/trips";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { IRoute, ITrip } from "./extractZip";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

const batchSize = 10000;

export const saveToDatabase = async (
	data: IRoute[] | ITrip[],
	table: string,
) => {
	const totalBatches = Math.ceil(data.length / batchSize);
	for (let i = 0; i < totalBatches; i++) {
		const batch = data.slice(i * batchSize, (i + 1) * batchSize);
		switch (table) {
			case "routes":
				await db.insert(routes).values(batch).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from routes to database`,
				);
				break;
			case "trips":
				await db.insert(trips).values(batch).onConflictDoNothing();
				console.log(
					`saved batch ${i + 1} of ${totalBatches} from trips to database`,
				);
				break;

			default:
				console.log("Unknown data type");
		}
	}
};
