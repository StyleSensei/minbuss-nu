import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const trips = pgTable("trips", {
	route_id: varchar(),
	service_id: varchar(),
	trip_id: varchar(),
	trip_headsign: varchar(),
	direction_id: integer(),
	shape_id: varchar(),
});

export const tripsInsertSchema = createInsertSchema(trips);
