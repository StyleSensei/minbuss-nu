"use client";
import { drizzle } from "drizzle-orm/postgres-js";
import { getVehiclePositions } from "../services/dataSources/gtfsRealtime";
import postgres from "postgres";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { APIProvider, Map } from "@vis.gl/react-google-maps";

export default function MapPage() {
	// const vehiclePositions = await getVehiclePositions();

	// if (!process.env.DATABASE_URL) {
	// 	throw new Error("DATABASE_URL is not defined");
	// }
	// const queryClient = postgres(process.env.DATABASE_URL);
	// const db = drizzle({ client: queryClient });
	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		throw new Error("GOOGLE_MAPS_API_KEY is not defined");
	}
	return (
		<div>
			<h1>Vehicle positions</h1>
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<Map
					style={{ width: "100vw", height: "100vh" }}
					defaultZoom={10}
					defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
					gestureHandling={"greedy"}
					// disableDefaultUI={true}
				/>
			</APIProvider>

			{/* <ul>
				{vehiclePositions.map((vehicle) => (
					<li key={vehicle.vehicle.id}>
						Vehicle ID: {vehicle.vehicle.id} - Position:{" "}
						{vehicle.position.latitude}, {vehicle.position.longitude}
					</li>
				))}
			</ul> */}
		</div>
	);
}
