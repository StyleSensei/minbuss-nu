"use server";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { routes } from "@/app/db/schema/routes";
import { asc, desc } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

export const selectAllroutes = async () => {
	try {
		const data = await db
			.select({ line: routes.route_short_name })
			.from(routes)
			.orderBy(asc(routes.route_id));
		return data;
	} catch (error) {
		console.log(error);
		return [];
	}
};
