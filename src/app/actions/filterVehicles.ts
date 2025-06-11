"use server";
import {
	getCachedDbData,
	getCachedVehiclePositions,
} from "../services/cacheHelper";
import { redis } from "../utilities/redis";
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

const FILTERED_VEHICLES_PREFIX = "filtered-vehicles-new-";
const FILTERED_VEHICLES_TTL = 5;

export const getFilteredVehiclePositions = async (
	busline?: string,
): Promise<IVehicleFilterResult> => {
	if (!busline) return { data: [] };

	const cacheKey = `${FILTERED_VEHICLES_PREFIX}${busline}`;

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

		const cachedFiltered = await redis.get(cacheKey);
		if (cachedFiltered) {
			if (
				typeof cachedFiltered === "object" &&
				"data" in cachedFiltered &&
				Array.isArray(cachedFiltered.data)
			) {
				if (
					cachedFiltered.data.length > 0 &&
					Math.abs(cachedFiltered.data.length - activeTrips.size) <= 1
				) {
					return cachedFiltered as IVehicleFilterResult;
				}
			}
			if (Array.isArray(cachedFiltered)) {
				return { data: cachedFiltered };
			}
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

		await redis.set(cacheKey, filteredData, { ex: FILTERED_VEHICLES_TTL });

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
			data: filteredData,
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
