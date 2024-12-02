import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
export const routes = pgTable("routes", {
	route_id: varchar(),
	agency_id: varchar(),
	route_short_name: varchar(),
	route_long_name: varchar(),
	route_type: integer(),
	route_desc: varchar(),
});
