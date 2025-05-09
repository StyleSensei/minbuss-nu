"use server";
import {
	getCachedDbData,
	getCachedVehiclePositions,
} from "../services/cacheHelper";
import { redis } from "../utilities/redis";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import type { IDbData } from "../models/IDbData";

export interface VehicleFilterResult {
	data: IVehiclePosition[];
	error?: {
		type: "DATA_TOO_OLD" | "API_ERROR" | "PARSING_ERROR" | "OTHER";
		message: string;
	};
}

const FILTERED_VEHICLES_PREFIX = "filtered-vehicles-";
const FILTERED_VEHICLES_TTL = 2; // 2 sekunder

export const getFilteredVehiclePositions = async (busline?: string) => {
	if (!busline) return { data: [] };

	const cacheKey = `${FILTERED_VEHICLES_PREFIX}${busline}`;

	try {
		const cachedVehiclePositions = await getCachedVehiclePositions();
		if (cachedVehiclePositions.error) {
			return cachedVehiclePositions;
		}

		let filteredData: IVehiclePosition[] = [];

		const activeTrips = new Set(
			cachedVehiclePositions.data
				.filter((vehicle) => vehicle?.trip?.tripId)
				.map((vehicle) => vehicle.trip.tripId),
		);

		console.log(`Aktiva resor just nu: ${activeTrips.size}`);
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
					return cachedFiltered as VehicleFilterResult;
				}
			}
			if (Array.isArray(cachedFiltered)) {
				return { data: cachedFiltered };
			}
		}

		const cachedDbData = (await getCachedDbData(busline)) as IDbData[];

		filteredData = cachedVehiclePositions.data?.filter((vehicle) =>
			cachedDbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
		);
		await redis.set(cacheKey, filteredData, { ex: FILTERED_VEHICLES_TTL });
		const result: VehicleFilterResult = { data: filteredData };

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
