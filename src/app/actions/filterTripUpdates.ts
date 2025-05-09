"use server";

import type { ITripUpdate } from "../models/ITripUpdate";
import { getCachedDbData, getCachedTripUpdates } from "../services/cacheHelper";

export const getFilteredTripUpdates = async (busline?: string) => {
	const cachedTripUpdates = await getCachedTripUpdates();
	let filteredData: ITripUpdate[] = [];
	if (!busline) return { data: [] };

	const cachedDbData = await getCachedDbData(busline);
	filteredData = cachedTripUpdates?.filter((vehicle) =>
		cachedDbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	);
	console.log(filteredData.length);

	return { data: filteredData };
};
