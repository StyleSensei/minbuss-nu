import { integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";

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
