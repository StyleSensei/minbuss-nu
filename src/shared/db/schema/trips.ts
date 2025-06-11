import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export const trips = pgTable("trips", {
	route_id: varchar(),
	service_id: integer(),
	trip_id: varchar(),
	trip_headsign: varchar(),
	direction_id: varchar(),
	shape_id: varchar(),
});

export const tripsInsertSchema = createInsertSchema(trips).extend({
	trip_id: z.string().nonempty("trip_id cannot be empty"),
});
export const tripsInsertSchemaArray = z.array(tripsInsertSchema);
