import {
	date,
	doublePrecision,
	integer,
	pgTable,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const stops = pgTable("stops", {
	stop_id: varchar(),
	stop_name: varchar(),
	stop_lat: doublePrecision(),
	stop_lon: doublePrecision(),
	location_type: integer(),
	parent_station: varchar(),
	platform_code: varchar(),
	feed_version: date(),
});

export const stopsInsertSchema = createInsertSchema(stops);
export const stopsInsertSchemaArray = z.array(stopsInsertSchema);
