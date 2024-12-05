"use server";
import { getVehiclePositions } from "../services/dataSources/gtfsRealtime";
import { selectFromDatabase } from "../services/dataProcessors/selectFromDatabase";

export const getFilteredVehiclePositions = async (busline: string) => {
	const dbData = await selectFromDatabase(busline);
	const vehiclePositions = await getVehiclePositions();
	const data = vehiclePositions?.filter((vehicle) =>
		dbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	);
	console.log("filtered data: ", data);
	console.log(data.length);
	return data;
};
