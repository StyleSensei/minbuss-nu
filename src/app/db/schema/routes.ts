import { integer, line, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
export const routes = pgTable("routes", {
	route_id: varchar(),
	agency_id: varchar(),
	route_short_name: varchar(),
	route_long_name: varchar(),
	route_type: integer(),
	route_desc: varchar(),
});

export const routesSelectSchema = createSelectSchema(routes);
export const lineSelectSchema = z.object({
	line: z.string().nullable(),
});

export const routesInsertSchema = createInsertSchema(routes);
