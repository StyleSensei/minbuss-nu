"use server";

import { lineSelectSchema, routes } from "@shared/db/schema/routes";
import { trips } from "@shared/db/schema/trips";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import {
	getDefaultOperator,
	resolveOperator,
} from "@/shared/config/gtfsOperators";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

export const getLatestFeedVersionFromDb = async (
	operatorInput = getDefaultOperator(),
): Promise<string | null> => {
	const operator = resolveOperator(operatorInput);
	const rows = await db
		.select({ v: sql<string>`MAX(${trips.feed_version})::text` })
		.from(trips)
		.where(eq(trips.operator, operator));
	const v = rows[0]?.v;
	return v ?? null;
};

export const selectAllroutesForLatestFeed = async (
	operatorInput = getDefaultOperator(),
) => {
	const operator = resolveOperator(operatorInput);
	const feedVersion = await getLatestFeedVersionFromDb(operator);
	if (!feedVersion) {
		return [];
	}
	return selectAllroutes(feedVersion, operator);
};

export const selectAllroutes = async (
	feedVersion: string,
	operatorInput = getDefaultOperator(),
) => {
	const operator = resolveOperator(operatorInput);
	try {
		const data = await db
			.select({ line: routes.route_short_name })
			.from(routes)
			.where(and(eq(routes.feed_version, feedVersion), eq(routes.operator, operator)))
			.orderBy(asc(routes.route_id));

		const parsed = z.array(lineSelectSchema).parse(data);
		return parsed;
	} catch (error) {
		console.log(error);
		return [];
	}
};
