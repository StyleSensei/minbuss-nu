"use server";

import type { ITripUpdate } from "@shared/models/ITripUpdate";
import { getCachedDbData, getCachedTripUpdates } from "../services/cacheHelper";

export const getFilteredTripUpdates = async (busline?: string) => {
	const cachedTripUpdates = await getCachedTripUpdates();
	let filteredData: ITripUpdate[] = [];
	if (!busline) return { data: [] };

	const cachedDbData = await getCachedDbData(busline);
	filteredData = cachedTripUpdates?.filter((vehicle) =>
		cachedDbData.currentTrips.some(
			(trip) => trip?.trip_id === vehicle?.trip?.tripId,
		),
	);

	return { data: filteredData };
};
