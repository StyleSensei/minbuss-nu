import { date, integer, pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const calendarDates = pgTable("calendar_dates", {
	service_id: integer().notNull(),
	date: date({ mode: "date" }),
	exception_type: integer(),
});
export const calendarDatesSelectSchema = createSelectSchema(calendarDates);
export const calendarDatesInsertSchema = createInsertSchema(
	calendarDates,
).extend({
	date: z
		.string()
		.regex(/^\d{8}$/, "Date must be in YYYYMMDD format")
		.transform((dateStr) => {
			// Konvertera YYYYMMDD till YYYY-MM-DD för PostgreSQL
			return new Date(
				`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`,
			);
		}),
});
export const calendarDatesInsertSchemaArray = z.array(
	calendarDatesInsertSchema,
);
