"use server";
import {
	getCachedDbData,
	getCachedVehiclePositions,
	getCachedShapesData,
} from "../services/cacheHelper";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import type { ITripData } from "../context/DataContext";

// Define an interface for timestamp age info
interface ITimestampAge {
	seconds: number;
	minutes: number;
	hours?: number;
}

// Define specific error types with their unique properties
interface IBaseError {
	message: string;
}

interface IDataTooOldError extends IBaseError {
	type: "DATA_TOO_OLD";
	timestampAge: ITimestampAge;
	isStale?: boolean;
	message: string;
}

interface IApiError extends IBaseError {
	type: "API_ERROR";
}

interface IParsingError extends IBaseError {
	type: "PARSING_ERROR";
}

interface IOtherError extends IBaseError {
	type: "OTHER";
}

// Use a union type for all possible errors
export type VehicleError =
	| IDataTooOldError
	| IApiError
	| IParsingError
	| IOtherError;

export interface IVehicleFilterResult {
	data: IVehiclePosition[];
	error?: VehicleError;
}

export const getFilteredVehiclePositions = async (
	busline?: string,
): Promise<IVehicleFilterResult> => {
	if (!busline) return { data: [] };

	try {
		const cachedVehiclePositions = await getCachedVehiclePositions();

		let filteredData: IVehiclePosition[] = [];

		const activeTrips = new Set(
			cachedVehiclePositions.data
				.filter((vehicle) => vehicle?.trip?.tripId)
				.map((vehicle) => vehicle.trip.tripId),
		);

		if (activeTrips.size === 0) {
			return { data: [] };
		}

		const cachedDbData = (await getCachedDbData(busline)) as ITripData;

		filteredData = cachedVehiclePositions.data?.filter((vehicle) => {
			if (!vehicle?.trip?.tripId) return false;

			const matchingTrip = cachedDbData.currentTrips.find(
				(trip) => trip?.trip_id === vehicle.trip.tripId,
			);

			if (!matchingTrip) return false;

			return true;
		});
		filteredData.sort((a, b) =>
			(a.trip?.tripId || "").localeCompare(b.trip?.tripId || ""),
		);

		const vehiclesWithShapes: IVehiclePosition[] = await Promise.all(
			filteredData.map(async (vehicle) => {
				const matchingTrip = cachedDbData.currentTrips.find(
					(trip) => trip?.trip_id === vehicle.trip.tripId,
				);

				if (matchingTrip?.shape_id) {
					const shapePoints = await getCachedShapesData(
						matchingTrip.feed_version,
						matchingTrip.shape_id,
					);
					return { ...vehicle, shapePoints } as IVehiclePosition;
				}
				return vehicle;
			}),
		);

		let vehicleError: VehicleError | undefined;
		if (cachedVehiclePositions.error) {
			const sourceError = cachedVehiclePositions.error;

			if (sourceError.type === "DATA_TOO_OLD" && sourceError.timestampAge) {
				vehicleError = {
					type: "DATA_TOO_OLD",
					message: sourceError.message,
					timestampAge: sourceError.timestampAge,
					isStale: sourceError.isStale,
				};
			} else if (sourceError.type === "API_ERROR") {
				vehicleError = {
					type: "API_ERROR",
					message: sourceError.message,
				};
			} else {
				vehicleError = {
					type: "OTHER",
					message: sourceError.message,
				};
			}
		}

		const result: IVehicleFilterResult = {
			data: vehiclesWithShapes,
			error: vehicleError,
		};

		return result;
	} catch (error) {
		console.error("Error in filtered vehicles", error);
		return {
			data: [],
			error: {
				type: "OTHER",
				message: "Ett fel uppstod vid filtrering av fordonsdata",
			},
		};
	}
};
