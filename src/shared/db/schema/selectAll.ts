import { z } from "zod";

export const selectAllSchema = z.object({
	operator: z.string().nullable(),
	// date: z.date().nullable(),
	shape_id: z.string().nullable(),
	departure_time: z.string().nullable(),
	stop_name: z.string().nullable(),
	stop_sequence: z.number().nullable(),
	stop_lat: z.number().nullable(),
	stop_lon: z.number().nullable(),
	stop_id: z.string().nullable(),
	trip_id: z.string().nullable(),
	// route_id: z.string().nullable(),
	route_short_name: z.string().nullable(),
	route_long_name: z.string().nullable().optional(),
	route_type: z.number().nullable().optional(),
	route_desc: z.string().nullable().optional(),
	stop_headsign: z.string().nullable(),
	feed_version: z.string().nullable(),
});
