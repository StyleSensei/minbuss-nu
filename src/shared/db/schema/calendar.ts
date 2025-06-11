import { boolean, integer, pgTable, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const calendar = pgTable("calendar", {
	service_id: integer().notNull(),
	monday: boolean(),
	tuesday: boolean(),
	wednesday: boolean(),
	thursday: boolean(),
	friday: boolean(),
	saturday: boolean(),
	sunday: boolean(),
	start_date: date(),
	end_date: date(),
});
export const calendarSelectSchema = createSelectSchema(calendar);
export const calendarInsertSchema = createInsertSchema(calendar);
export const calendarInsertSchemaArray = z.array(calendarInsertSchema);
