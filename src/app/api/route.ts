import { NextResponse } from "next/server";
// import { drizzle } from 'drizzle-orm/vercel-postgres';

import { selectFromDatabase } from "../services/dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "../services/dataSources/gtfsRealtime";
import { db } from "@vercel/postgres";
import {
	getCachedDbData,
	getCachedVehiclePositions,
} from "../actions/filterVehicles";

export const GET = async () => {
	// const db = drizzle();
	// const dbData = await getCachedDbData("177");
	// const vehiclePositions = await getCachedVehiclePositions();
	// const data = vehiclePositions?.filter((vehicle) =>
	// 	dbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	// );
	const data = await getCachedDbData("177");

	console.log("filtered data: ", data);
	// const result = await db.execute('select 1');
	return NextResponse.json({ data });
};
