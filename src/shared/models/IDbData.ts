export interface IDbData {
	trip_id: string;
	shape_id: string;
	route_short_name: string;
	route_long_name?: string | null;
	route_type?: number | null;
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
