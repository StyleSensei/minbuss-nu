"use server";
import {
	getCachedDbData,
	getCachedVehiclePositions,
} from "../services/cacheHelper";
import {
	getVehiclePositions,
	type IVehiclePosition,
} from "../services/dataSources/gtfsRealtime";

export const getFilteredVehiclePositions = async (busline?: string) => {
	const cachedVehiclePositions = await getCachedVehiclePositions();
	let data: IVehiclePosition[] = [];
	if (!busline) {
		data = cachedVehiclePositions;
		return data;
	}

	const cachedDbData = await getCachedDbData(busline);
	data = cachedVehiclePositions?.filter((vehicle) =>
		cachedDbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	);
	console.log(data.length);
	// console.log(data);

	return data;
};
