export interface IDbData {
	operator?: string;
	trip_id: string;
	shape_id: string;
	route_short_name: string;
	route_long_name?: string | null;
	route_type?: number | null;
	route_desc?: string | null;
	stop_headsign: string;
	stop_id: string;
	departure_time: string;
	/** GTFS service calendar date (YYYY-MM-DD), used for midnight-safe sort/filter. */
	service_date?: string | null;
	stop_name: string;
	platform_code?: string | null;
	stop_sequence: number;
	stop_lat: number;
	stop_lon: number;
	feed_version: string;
}
