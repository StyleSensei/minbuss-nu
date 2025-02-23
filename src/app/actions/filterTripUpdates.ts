"use server";

import type { ITripUpdate } from "../models/ITripUpdate";
import { getCachedDbData, getCachedTripUpdates } from "../services/cacheHelper";

export const getFilteredTripUpdates = async (busline?: string) => {
	const cachedTripUpdates = await getCachedTripUpdates();
	let data: ITripUpdate[] = [];
	if (!busline) return data;

	const cachedDbData = await getCachedDbData(busline);
	data = cachedTripUpdates?.filter((vehicle) =>
		cachedDbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	);
	console.log(data.length);
	// console.log(data);

	return data;
};
