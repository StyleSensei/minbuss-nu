import { NextResponse } from "next/server";
// import { drizzle } from 'drizzle-orm/vercel-postgres';

import { selectFromDatabase } from "../services/dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "../services/dataSources/gtfsRealtime";
import { db } from "@vercel/postgres";

// import { drizzle } from "drizzle-orm/postgres-js";
// import { routes } from "../db/schema/routes";

export const GET = async () => {
	// const db = drizzle();
	const dbData = await selectFromDatabase("177");
	const vehiclePositions = await getVehiclePositions();
	const data = vehiclePositions?.filter((vehicle) =>
		dbData.some((trip) => trip?.trip_id === vehicle?.trip?.tripId),
	);

	console.log("filtered data: ", data);
	// const result = await db.execute('select 1');
	return NextResponse.json({ data });
};
// const db = drizzle(routes);
// await db.select().from(routes);
