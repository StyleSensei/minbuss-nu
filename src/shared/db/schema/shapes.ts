import { date, integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const shapes = pgTable("shapes", {
	shape_id: varchar().notNull(),
	shape_pt_lat: numeric().notNull(),
	shape_pt_lon: numeric().notNull(),
	shape_pt_sequence: integer().notNull(),
	shape_dist_traveled: numeric(),
	feed_version: date(),
});

export const shapesSelectSchema = createSelectSchema(shapes);
export const shapesInsertSchema = createInsertSchema(shapes);
export const shapesInsertSchemaArray = z.array(shapesInsertSchema);
