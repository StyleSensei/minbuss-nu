"use server";

import { getCachedVehiclePositions } from "./filterVehicles";

export const getCurrentTripIds = async () => {
	const cachedVehiclePositions = await getCachedVehiclePositions();
	const filteredTripIds = cachedVehiclePositions
		.map((vehicle) => vehicle?.trip?.tripId)
		.filter((tripId) => tripId !== undefined) as string[];

	return { filteredTripIds };
};
