"use client";
import { drizzle } from "drizzle-orm/postgres-js";
import {
	getVehiclePositions,
	type IVehiclePosition,
} from "../services/dataSources/gtfsRealtime";
import postgres from "postgres";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { AdvancedMarker, APIProvider, Map } from "@vis.gl/react-google-maps";
import { Button } from "../components/Button";
import { bus, search } from "../../../public/icons";
import { useState } from "react";
import { getFilteredVehiclePositions } from "../actions/filterVehicles";
import { SearchBar } from "../components/SearchBar";
import { useFilterContext } from "../context/FilterContext";

export default function MapPage() {
	const [vehiclePositions, setVehiclePositions] = useState<IVehiclePosition[]>(
		[],
	);
	const handleOnClick = async () => {
		setVehiclePositions(await getFilteredVehiclePositions("177"));
	};

	const { filteredVehicles } = useFilterContext();

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
			{/* <SearchBar title="search-bus" iconSize="24" path={search} /> */}

			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<Map
					style={{ width: "100vw", height: "100vh" }}
					defaultZoom={10}
					defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
					gestureHandling={"greedy"}
					mapId={"SHOW_BUSES"}
					// disableDefaultUI={true}
				>
					{filteredVehicles?.map((vehicle) => {
						return (
							<AdvancedMarker
								key={vehicle?.vehicle?.id}
								position={{
									lat: vehicle?.position?.latitude,
									lng: vehicle?.position?.longitude,
								}}
							/>
						);
					})}
					{/* {vehiclePositions.length && (
						<AdvancedMarker
							key={vehiclePositions[1000]?.vehicle?.id}
							position={{
								lat: vehiclePositions[1000]?.position?.latitude,
								lng: vehiclePositions[1000]?.position?.longitude,
							}}
						/>
					)} */}
				</Map>
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
