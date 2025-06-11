import { z } from "zod";

export const selectAllSchema = z.object({
	// date: z.date().nullable(),
	departure_time: z.string().nullable(),
	stop_name: z.string().nullable(),
	stop_sequence: z.number().nullable(),
	stop_lat: z.number().nullable(),
	stop_lon: z.number().nullable(),
	stop_id: z.string().nullable(),
	trip_id: z.string().nullable(),
	// route_id: z.string().nullable(),
	route_short_name: z.string().nullable(),
	stop_headsign: z.string().nullable(),
});
