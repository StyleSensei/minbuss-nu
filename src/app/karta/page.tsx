"use client";
import {
	Map as GoogleMap,
	APIProvider,
	MapControl,
	ControlPosition,
	type MapEvent,
	InfoWindow,
	useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";

import { useDataContext } from "../context/DataContext";
import CustomMarker from "../components/CustomMarker";
import { ZoomButtons } from "../components/ZoomButtons";
import { Button } from "../components/Button";
import { useEffect, useRef, useState } from "react";
import TextBlock from "../components/Textblock";

export default function MapPage() {
	const { filteredVehicles, cachedDbDataState } = useDataContext();
	const mapRef = useRef<google.maps.Map | null>(null);
	const [zoomAction, setZoomAction] = useState(false);
	// const [infoWindowActive, setInfoWindowActive] = useState(false);
	const [clickedOutside, setClickedOutside] = useState(false);

	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		throw new Error("GOOGLE_MAPS_API_KEY is not defined");
	}

	const zoomIn = (GoogleMap: google.maps.Map) => {
		// biome-ignore lint/style/noNonNullAssertion: <Returns the zoom of the map. If the zoom has not been set then the result is undefined.>
		GoogleMap.setZoom(GoogleMap.getZoom()! + 1);
	};
	const zoomOut = (GoogleMap: google.maps.Map) => {
		// biome-ignore lint/style/noNonNullAssertion: <Returns the zoom of the map. If the zoom has not been set then the result is undefined.>
		GoogleMap.setZoom(GoogleMap.getZoom()! - 1);
	};
	return (
		<div>
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<GoogleMap
					style={{ width: "100vw", height: "100vh" }}
					defaultZoom={10}
					defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
					gestureHandling={"greedy"}
					onTilesLoaded={(e: MapEvent) => {
						const map = e.map as google.maps.Map;
						mapRef.current = map;
					}}
					mapId={"SHOW_BUSES"}
					disableDefaultUI={true}
					rotateControl={false}
					mapTypeControl={false}
					streetViewControl={false}
					fullscreenControl={false}
					onClick={() => setClickedOutside(true)}
					// onZoomChanged={(e: MapEvent) => {
					// 	if (zoomAction) return;
					// 	setZoomAction(true);
					// 	console.log("zoom changed", e);
					// }}
					// onIdle={() => {
					// 	if (!zoomAction) return;
					// 	setZoomAction(false);
					// 	console.log("idle");
					// }}

					colorScheme="DARK"
					reuseMaps={true}
					restriction={{
						latLngBounds: { north: 60, south: 58.5, east: 18.5, west: 17.5 },
					}}
					minZoom={8}
					zoomControlOptions={{
						position: ControlPosition.INLINE_END_BLOCK_START,
					}}
				>
					<MapControl position={ControlPosition.INLINE_END_BLOCK_START}>
						<ZoomButtons
							googleMapRef={mapRef}
							zoomIn={zoomIn}
							zoomOut={zoomOut}
						/>
					</MapControl>
					{filteredVehicles.map((vehicle) => (
						<CustomMarker
							googleMapRef={mapRef}
							zoomAction={zoomAction}
							clickedOutside={clickedOutside}
							setClickedOutside={setClickedOutside}
							setZoomAction={setZoomAction}
							currentVehicle={vehicle}
							key={vehicle.vehicle.id}
							position={{
								lat: vehicle.position.latitude,
								lng: vehicle.position.longitude,
							}}
						/>
					))}
				</GoogleMap>
			</APIProvider>
		</div>
	);
}
