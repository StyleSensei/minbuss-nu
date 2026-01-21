import { pgTable, varchar, numeric, integer } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const shapes = pgTable("shapes", {
    shape_id: varchar().notNull(),
    shape_pt_lat: numeric().notNull(),
    shape_pt_lon: numeric().notNull(),
    shape_pt_sequence: integer().notNull(),
    shape_dist_traveled: numeric(),
});

export const shapesSelectSchema = createSelectSchema(shapes);
export const shapesInsertSchema = createInsertSchema(shapes);
export const shapesInsertSchemaArray = z.array(shapesInsertSchema);