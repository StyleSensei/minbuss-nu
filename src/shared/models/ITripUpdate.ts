export interface IStopTimeUpdate {
	stopId: string;
	arrival: { time: string; delay: number; uncertainty: number } | null;
	departure: { time: string; delay: number; uncertainty: number } | null;
	stopSequence: number;
}

export interface ITripUpdate {
	trip: {
		tripId: string | null;
		startDate: string | null;
		scheduleRelationship: string | null;
	};
	stopTimeUpdate: IStopTimeUpdate[];
	vehicle: { id: string } | null;
	timestamp: string | null;
}
