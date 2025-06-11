"use server";
import { getCachedDbData } from "../services/cacheHelper";
import type { ITripData } from "../context/DataContext";

export async function fetchCachedDbData(
	busLine: string,
	busStopName?: string,
): Promise<ITripData> {
	return await getCachedDbData(busLine, busStopName);
}
