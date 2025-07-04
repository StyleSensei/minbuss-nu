import { date, integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export const trips = pgTable("trips", {
	route_id: varchar(),
	service_id: integer(),
	trip_id: varchar(),
	trip_headsign: varchar(),
	direction_id: integer(),
	shape_id: varchar(),
	feed_version: date(),
});

export const tripsInsertSchema = createInsertSchema(trips).extend({
	trip_id: z.string().nonempty("trip_id cannot be empty"),
	direction_id: z.number(),
});
export const tripsInsertSchemaArray = z.array(tripsInsertSchema);
