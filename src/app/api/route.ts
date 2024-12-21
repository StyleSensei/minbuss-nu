import { NextResponse } from "next/server";
// import { drizzle } from 'drizzle-orm/vercel-postgres';

import {
	// selectAllroutes,
	selectFromDatabase,
} from "../services/dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "../services/dataSources/gtfsRealtime";
import { db } from "@vercel/postgres";
import {
	getCachedDbData,
	getCachedVehiclePositions,
} from "../services/cacheHelper";
import { getFilteredVehiclePositions } from "../actions/filterVehicles";
import { getCurrentTripIds } from "../actions/getCurrentTripIds";
import { selectAllroutes } from "../services/dataProcessors/selectAllRoutes";

export const GET = async () => {
	// const db = drizzle();
	// const data = await getCachedDbData("177");
	const data = await getCachedVehiclePositions();
	// const tripidsFromVP = data?.map((vehicle) => vehicle?.trip?.tripId);
	// const correctBus = data?.find(
	// 	(vehicle) => vehicle?.trip?.tripId === "14010000630848092",
	// );
	// const tripIds = await getCurrentTripIds();
	const routes = await selectAllroutes();
	// const data = vehiclePositions?.filter((vehicle) =>
	// 	dbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	// );
	// const data = await getFilteredVehiclePositions("177");
	// const data = await getCachedDbData("177");
	// const data = await selectFromDatabase("177");
	// console.log("data: ", data);
	// console.log("correctBus: ", correctBus);
	// const result = await db.execute('select 1');
	return NextResponse.json({ routes });
};
