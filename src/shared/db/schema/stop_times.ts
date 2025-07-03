import { integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const stop_times = pgTable("stop_times", {
	trip_id: varchar(),
	arrival_time: varchar(),
	departure_time: varchar(),
	stop_id: varchar(),
	stop_sequence: integer(),
	stop_headsign: varchar(),
	pickup_type: integer(),
	drop_off_type: integer(),
	shape_dist_traveled: numeric(),
	timepoint: integer(),
});

export const stopTimesInsertSchema = createInsertSchema(stop_times);
export const stopTimesInsertSchemaArray = z.array(stopTimesInsertSchema);
