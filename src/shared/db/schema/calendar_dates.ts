import { date, integer, pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const calendarDates = pgTable("calendar_dates", {
	service_id: integer().notNull(),
	date: date({ mode: "date" }), // YYYYMMDD
	exception_type: integer(), // 1 for added service, 2 for removed service
});
export const calendarDatesSelectSchema = createSelectSchema(calendarDates);
export const calendarDatesInsertSchema = createInsertSchema(calendarDates);
export const calendarDatesInsertSchemaArray = z.array(
	calendarDatesInsertSchema,
);
