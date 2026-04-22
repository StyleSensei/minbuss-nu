import { date, integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const shapes = pgTable("shapes", {
	operator: varchar().notNull(),
	shape_id: varchar().notNull(),
	shape_pt_lat: numeric().notNull(),
	shape_pt_lon: numeric().notNull(),
	shape_pt_sequence: integer().notNull(),
	shape_dist_traveled: numeric(),
	feed_version: date(),
});

export const shapesSelectSchema = createSelectSchema(shapes);
export const shapesInsertSchema = createInsertSchema(shapes, {
	/** GTFS: tom sträng för valfri kolumn; Postgres numeric accepterar inte "". */
	shape_dist_traveled: (schema) =>
		z.preprocess((val) => {
			if (val === "" || val === null || val === undefined) return undefined;
			if (typeof val === "string" && val.trim() === "") return undefined;
			return val;
		}, schema),
});
export const shapesInsertSchemaArray = z.array(shapesInsertSchema);
