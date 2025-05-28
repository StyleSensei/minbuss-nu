"use server";
import { cache } from "react";
import { redis } from "../utilities/redis";
import { selectFromDatabase } from "./dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "./dataSources/gtfsRealtime";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { getTripUpdates } from "./dataSources/gtfsTripUpdates";
import type { IDbData } from "@shared/models/IDbData";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import { MetricsTracker } from "../utilities/MetricsTracker";

interface VehiclePositionResult {
	data: IVehiclePosition[];
	error?: IError;
}
export interface IError {
	type: "API_ERROR" | "DATA_TOO_OLD" | "OTHER";
	message: string;
	timestampAge?: ITimestampAge;
	isStale?: boolean;
}
interface ITimestampAge {
	seconds: number;
	minutes: number;
	hours?: number;
}

interface DataTooOldError extends Error {
	timestampAge?: ITimestampAge;
}

const VEHICLE_POSITIONS_CACHE_KEY = "vehicle-positions-cache";
const TRIP_UPDATES_CACHE_KEY = "trip-updates-cache";
const DB_DATA_CACHE_KEY_PREFIX = "db-data-cache-";

// TTL i sekunder
const REALTIME_TTL = 2;
const DB_DATA_TTL = 5 * 60;

export const getCachedVehiclePositions = cache(
	async (): Promise<VehiclePositionResult> => {
		const cached = await redis.get(VEHICLE_POSITIONS_CACHE_KEY);
		if (cached) {
			MetricsTracker.trackCacheHit();
			return cached as VehiclePositionResult;
		}
		try {
			MetricsTracker.trackCacheMiss();
			const response = await getVehiclePositions();

			if (response.isStale && response.timestampAge) {
				const result: VehiclePositionResult = {
					data: response.data,
					error: {
						type: "DATA_TOO_OLD",
						message: "Saknar aktuell realtidsdata",
						timestampAge: response.timestampAge,
						isStale: response.isStale,
					},
				};

				await redis.set(VEHICLE_POSITIONS_CACHE_KEY, result, {
					ex: REALTIME_TTL,
				});
				return result;
			}

			// Normal case - fresh data
			const result: VehiclePositionResult = { data: response.data };
			await redis.set(VEHICLE_POSITIONS_CACHE_KEY, result, {
				ex: REALTIME_TTL,
			});
			return result;
		} catch (error) {
			console.error("Error fetching vehicle positions:", error);
			if (error instanceof Error) {
				if (error.name === "DataTooOld") {
					const dataError = error as unknown as DataTooOldError;
					return {
						data: [],
						error: {
							type: "DATA_TOO_OLD",
							message: "Aktuell realtidsdata saknas",
							timestampAge: dataError.timestampAge,
						},
					};
				}
				return {
					data: [],
					error: {
						type: "API_ERROR",
						message: "Kunde inte hämta realtidsdata",
					},
				};
			}
			return {
				data: [],
				error: {
					type: "OTHER",
					message: "Ett okänt fel uppstod",
				},
			};
		}
	},
);

export const getCachedTripUpdates = cache(async () => {
	const cached = await redis.get(TRIP_UPDATES_CACHE_KEY);
	if (cached) {
		MetricsTracker.trackCacheHit();
		return cached as ITripUpdate[];
	}

	const data = await getTripUpdates();

	await redis.set(TRIP_UPDATES_CACHE_KEY, data, { ex: REALTIME_TTL });
	MetricsTracker.trackRedisOperation();
	return data;
});

export const getCachedDbData = cache(
	async (busLine: string, forceRefresh = false) => {
		const cacheKey = `${DB_DATA_CACHE_KEY_PREFIX}${busLine}`;

		if (!forceRefresh) {
			const cached = await redis.get(cacheKey);
			if (cached) {
				MetricsTracker.trackCacheHit();
				return cached as IDbData[];
			}
		}

		MetricsTracker.trackDbQuery();
		const data = await selectFromDatabase(busLine);

		await redis.set(cacheKey, data, { ex: DB_DATA_TTL });
		MetricsTracker.trackRedisOperation();

		return data;
	},
);

MetricsTracker.enableLogging(false);
