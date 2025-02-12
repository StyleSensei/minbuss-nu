import { integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const stop_times = pgTable("stop_times", {
	trip_id: varchar(),
	arrival_time: varchar(),
	departure_time: varchar(),
	stop_id: varchar(),
	stop_sequence: varchar(),
	stop_headsign: varchar(),
	pickup_type: varchar(),
	drop_off_type: varchar(),
	shape_dist_traveled: numeric(),
	timepoint: varchar(),
});

export const stopTimesInsertSchema = createInsertSchema(stop_times);
export const stopTimesInsertSchemaArray = z.array(stopTimesInsertSchema);
