export interface IStopTime {
	trip_id: string;
	departure_time: string;
	stop_id: string;
	stop_sequence: number;
	stop_headsign: string;
	pickup_type: number;
	drop_off_type: number;
	shape_dist_traveled: number | string;
	timepoint: number;
}
