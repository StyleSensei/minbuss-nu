"use server";

import { lineSelectSchema, routes } from "@shared/db/schema/routes";
import { trips } from "@shared/db/schema/trips";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

export const getLatestFeedVersionFromDb = async (): Promise<string | null> => {
	const rows = await db
		.select({ v: sql<string>`MAX(${trips.feed_version})::text` })
		.from(trips);
	const v = rows[0]?.v;
	return v ?? null;
};

export const selectAllroutesForLatestFeed = async () => {
	const feedVersion = await getLatestFeedVersionFromDb();
	if (!feedVersion) {
		return [];
	}
	return selectAllroutes(feedVersion);
};

export const selectAllroutes = async (feedVersion: string) => {
	try {
		const data = await db
			.select({ line: routes.route_short_name })
			.from(routes)
			.where(eq(routes.feed_version, feedVersion))
			.orderBy(asc(routes.route_id));

		const parsed = z.array(lineSelectSchema).parse(data);
		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};
