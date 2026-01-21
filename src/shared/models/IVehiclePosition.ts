import { IShapes } from "./IShapes";

export interface IVehiclePosition {
	trip: {
		tripId: string | null;
		scheduleRelationship: string | null;
	};
	position: {
		latitude: number;
		longitude: number;
		bearing: number | null;
		speed: number | null;
	};
	timestamp: string | null;
	vehicle: {
		id: string;
	};
	shapePoints?: IShapes[];
}
