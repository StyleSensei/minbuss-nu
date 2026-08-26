export interface IStopBoardChild {
	stop_id: string;
	stop_name: string;
	location_type: number;
	parent_station: string;
	platform_code?: string | null;
	stop_lat: number;
	stop_lon: number;
}

export type StopBoardMode = number | null;
