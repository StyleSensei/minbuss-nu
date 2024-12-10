"use client";
import {
	// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
	Map,
	APIProvider,
} from "@vis.gl/react-google-maps";

import { useFilterContext } from "../context/FilterContext";
import CustomMarker from "../components/CustomMarker";

export default function MapPage() {
	const { filteredVehicles } = useFilterContext();

	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		throw new Error("GOOGLE_MAPS_API_KEY is not defined");
	}

	return (
		<div>
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<Map
					style={{ width: "100vw", height: "100vh" }}
					defaultZoom={10}
					defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
					gestureHandling={"greedy"}
					mapId={"SHOW_BUSES"}
				>
					{filteredVehicles.map((vehicle) => (
						<CustomMarker
							key={vehicle.vehicle.id}
							position={{
								lat: vehicle.position.latitude,
								lng: vehicle.position.longitude,
							}}
						/>
					))}
				</Map>
			</APIProvider>
		</div>
	);
}
