export interface IDbData {
	trip_id: string;
	shape_id: string;
	route_short_name: string;
	/** GTFS routes.route_long_name (optional when row comes from minimal selects). */
	route_long_name?: string | null;
	/** GTFS routes.route_type (optional when row comes from minimal selects). */
	route_type?: number | null;
	/** GTFS routes.route_desc (optional when row comes from minimal selects). */
	route_desc?: string | null;
	stop_headsign: string;
	stop_id: string;
	departure_time: string;
	stop_name: string;
	stop_sequence: number;
	stop_lat: number;
	stop_lon: number;
	feed_version: string;
}
