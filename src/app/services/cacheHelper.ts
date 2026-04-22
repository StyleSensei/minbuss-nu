"use server";
import { cache } from "react";
import { redis } from "../utilities/redis";
import {
	selectCurrentTripsFromDatabase,
	selectDistinctShapeIdsForLineFromDatabase,
	selectDistinctStopsForLineFromDatabase,
	selectShapesFromDatabase,
	selectUpcomingTripsFromDatabase,
} from "./dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "./dataSources/gtfsRealtime";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { getTripUpdates } from "./dataSources/gtfsTripUpdates";
import type { IDbData } from "@shared/models/IDbData";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import { MetricsTracker } from "../utilities/MetricsTracker";
import type { ITripData } from "../context/DataContext";
import type { IShapes } from "@/shared/models/IShapes";
import {
	getDefaultOperator,
	resolveOperator,
} from "@/shared/config/gtfsOperators";

interface VehiclePositionResult {
	data: IVehiclePosition[];
	error?: IError;
}
export interface IError {
	type: "API_ERROR" | "DATA_TOO_OLD" | "OTHER" | "LOCK_ERROR" | "TIMEOUT_ERROR";
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
const TRIP_UPDATES_LOCK_KEY = "trip-updates-lock";

// TTL i sekunder
const REALTIME_TTL = 4;
const LOCK_TTL = 4;
const LOCK_RETRY_DELAY = 100;
const LOCK_MAX_RETRIES = 10;
const VEHICLE_LOCK_KEY = "vehicle-positions-lock";

const vehiclePositionsCacheKey = (operator: string) =>
	`${VEHICLE_POSITIONS_CACHE_KEY}:${operator}`;
const tripUpdatesCacheKey = (operator: string) =>
	`${TRIP_UPDATES_CACHE_KEY}:${operator}`;
const tripUpdatesLockKey = (operator: string) =>
	`${TRIP_UPDATES_LOCK_KEY}:${operator}`;
const vehicleLockKey = (operator: string) => `${VEHICLE_LOCK_KEY}:${operator}`;

export const getCachedVehiclePositions = cache(
	async (operatorInput = getDefaultOperator()): Promise<VehiclePositionResult> => {
		const operator = resolveOperator(operatorInput);
		const cacheKey = vehiclePositionsCacheKey(operator);
		const lockKey = vehicleLockKey(operator);
		const cached = await redis.get(cacheKey);
		if (cached) {
			MetricsTracker.trackCacheHit();
			return cached as VehiclePositionResult;
		}
		const lockAcquired = await redis.set(lockKey, "locked", {
			nx: true,
			ex: LOCK_TTL,
		});

		if (!lockAcquired) {
			return await waitForCachedData(cacheKey);
		}

		try {
			MetricsTracker.trackCacheMiss();
			const response = await getVehiclePositions(operator);

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

				await redis.set(cacheKey, result, {
					ex: REALTIME_TTL,
				});
				return result;
			}

			// Normal case - fresh data
			const result: VehiclePositionResult = { data: response.data };
			await redis.set(cacheKey, result, {
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
		} finally {
			await redis.del(lockKey);
		}
	},
);

async function waitForCachedData(cacheKey: string): Promise<VehiclePositionResult> {
	for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
		await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY));

		const cached = await redis.get(cacheKey);
		if (cached) {
			return cached as VehiclePositionResult;
		}
	}

	return {
		data: [],
		error: {
			message: "Timeout waiting for vehicle data",
			type: "TIMEOUT_ERROR",
		},
	};
}

export const getCachedTripUpdates = cache(
	async (operatorInput = getDefaultOperator()) => {
		const operator = resolveOperator(operatorInput);
		const cacheKey = tripUpdatesCacheKey(operator);
		const lockKey = tripUpdatesLockKey(operator);
		const cached = await redis.get(cacheKey);
		if (cached) {
			MetricsTracker.trackCacheHit();
			return cached as ITripUpdate[];
		}

		const lockAcquired = await redis.set(lockKey, "locked", {
			nx: true,
			ex: LOCK_TTL,
		});

		if (!lockAcquired) {
			return await waitForCachedTripUpdates(cacheKey);
		}

		try {
			MetricsTracker.trackCacheMiss();
			const data = await getTripUpdates(operator);
			await redis.set(cacheKey, data, { ex: REALTIME_TTL });
			MetricsTracker.trackRedisOperation();
			return data;
		} catch (error) {
			console.error("Error fetching trip updates:", error);
			return [];
		} finally {
			await redis.del(lockKey);
		}
	},
);

async function waitForCachedTripUpdates(cacheKey: string): Promise<ITripUpdate[]> {
	for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
		await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY));

		const cached = await redis.get(cacheKey);
		if (cached) {
			return cached as ITripUpdate[];
		}
	}

	return [];
}

async function getLineShapesForTrips(
	trips: IDbData[],
	operator: string,
): Promise<{ shape_id: string; points: IShapes[] }[]> {
	const seen = new Set<string>();
	const shapeIds: string[] = [];
	for (const t of trips) {
		if (t.shape_id && !seen.has(t.shape_id)) {
			seen.add(t.shape_id);
			shapeIds.push(t.shape_id);
		}
	}
	const results = await Promise.all(
		shapeIds.map(async (shape_id) => {
			const points = await selectShapesFromDatabase(shape_id, operator);
			return points.length ? { shape_id, points } : null;
		}),
	);
	return results.filter((x): x is NonNullable<typeof x> => x !== null);
}

export const getCachedDbData = cache(
	async (
		busLine: string,
		busStopName?: string,
		operatorInput = getDefaultOperator(),
	) => {
		const operator = resolveOperator(operatorInput);
		let currentTrips: IDbData[] = [];
		let upcomingTrips: IDbData[] = [];
		let lineStops: IDbData[] = [];

		const trimmedStopName = busStopName?.trim() || undefined;

		if (trimmedStopName) {
			MetricsTracker.trackDbQuery();
			upcomingTrips = await selectUpcomingTripsFromDatabase(
				busLine,
				trimmedStopName,
				operator,
			);
		} else {
			MetricsTracker.trackDbQuery();
			const [current, stops] = await Promise.all([
				selectCurrentTripsFromDatabase(busLine, operator),
				selectDistinctStopsForLineFromDatabase(busLine, operator),
			]);
			currentTrips = current;
			lineStops = stops;
		}

		const tripsForShapes = [...currentTrips, ...upcomingTrips];
		let lineShapes = await getLineShapesForTrips(tripsForShapes, operator);
		if (!lineShapes.length && !trimmedStopName) {
			const shapeIds = await selectDistinctShapeIdsForLineFromDatabase(
				busLine,
				operator,
			);
			const fallbackTrips = shapeIds.map((shape_id) => ({
				operator,
				trip_id: "",
				shape_id,
				route_short_name: busLine,
				stop_headsign: "",
				stop_id: "",
				departure_time: "",
				stop_name: "",
				stop_sequence: 0,
				stop_lat: 0,
				stop_lon: 0,
				feed_version: "",
			}));
			lineShapes = await getLineShapesForTrips(fallbackTrips, operator);
		}

		return { currentTrips, upcomingTrips, lineStops, lineShapes } as ITripData;
	},
);

export const getCachedShapesData = cache(
	async (_feedVersion: string, shapeId: string, operatorInput = getDefaultOperator()) => {
		const operator = resolveOperator(operatorInput);
		MetricsTracker.trackDbQuery();
		const shapePoints = await selectShapesFromDatabase(shapeId, operator);
		return shapePoints;
	},
);

MetricsTracker.enableLogging(false);
