import {
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
	stop_lat: varchar(),
	stop_lon: varchar(),
	location_type: varchar(),
	parent_station: varchar(),
	platform_code: varchar(),
});

export const stopsInsertSchema = createInsertSchema(stops);
export const stopsInsertSchemaArray = z.array(stopsInsertSchema);
