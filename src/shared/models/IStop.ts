export interface IStop {
	operator: string;
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	location_type: number;
	parent_station: string;
	platform_code: string;
}
