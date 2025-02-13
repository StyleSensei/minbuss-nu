"use client";
import {
	Map as GoogleMap,
	APIProvider,
	MapControl,
	ControlPosition,
	type MapEvent,
	AdvancedMarker,
} from "@vis.gl/react-google-maps";

import { useDataContext } from "../context/DataContext";
import CustomMarker from "../components/CustomMarker";
import { MapControlButtons } from "../components/MapControlButtons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IDbData } from "../models/IDbData";
import { CurrentTrips } from "../components/CurrentTrips";

export default function MapPage() {
	const { filteredVehicles, cachedDbDataState } = useDataContext();
	const mapRef = useRef<google.maps.Map | null>(null);
	const [clickedOutside, setClickedOutside] = useState(false);
	const [zoomWindowLevel, setCurrentWindowZoomLevel] = useState(100);
	const [lastStops, setLastStops] = useState<IDbData[]>([]);
	const [showCurrentTrips, setShowCurrentTrips] = useState(false);
	const [infoWindowActive, setInfoWindowActive] = useState(false);
	const [followBus, setFollowBus] = useState(false);
	const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
	const [userLocation, setUserLocation] =
		useState<GeolocationPosition | null>();

	useEffect(() => {
		const ctaButton = document.getElementById("cta");
		const backgroundImage = document.getElementById("background-image");
		ctaButton?.classList.add("--hidden");
		backgroundImage?.classList.add("--hidden");

		return () => {
			ctaButton?.classList.remove("--hidden");
			backgroundImage?.classList.remove("--hidden");
		};
	}, []);

	useEffect(() => {
		navigator.geolocation.getCurrentPosition((position) => {
			setUserLocation(position);
		});
		return () => {
			setUserLocation(null);
		};
	}, []);

	useEffect(() => {
		const main = document.getElementById("main");
		if (followBus) {
			main?.classList.add("follow-bus-active");
		}
		return () => {
			main?.classList.remove("follow-bus-active");
		};
	}, [followBus]);

	const getMaxObjectsById = useCallback((array: IDbData[]) => {
		const map = new Map();

		for (const item of array) {
			const current = map.get(item.trip_id);
			if (!current || item.stop_sequence > current.stop_sequence) {
				map.set(item.trip_id, item);
			}
		}

		return Array.from(map.values());
	}, []);

	useEffect(() => {
		if (filteredVehicles.length === 0) {
			setLastStops([]);
			setShowCurrentTrips(false);
		}
		const lastStops = getMaxObjectsById(cachedDbDataState);
		setLastStops(lastStops);
	}, [cachedDbDataState, getMaxObjectsById, filteredVehicles]);

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

	const getWindowZoomLevel = useCallback(() => {
		const zoomLevel = ((window.outerWidth - 10) / window.innerWidth) * 100;
		setCurrentWindowZoomLevel(zoomLevel);
		return zoomLevel;
	}, []);

	useEffect(() => {
		window.addEventListener("resize", getWindowZoomLevel);
		window.addEventListener("zoom", getWindowZoomLevel);

		getWindowZoomLevel();

		return () => {
			window.removeEventListener("resize", getWindowZoomLevel);
			window.removeEventListener("zoom", getWindowZoomLevel);
		};
	}, [getWindowZoomLevel]);

	return (
		<div>
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<GoogleMap
					style={{ width: "100vw", height: "100vh", zIndex: "unset" }}
					defaultZoom={10}
					defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
					gestureHandling={"greedy"}
					onTilesLoaded={(e: MapEvent) => {
						const map = e.map as google.maps.Map;
						mapRef.current = map;
					}}
					mapId={"SHOW_BUSES"}
					onZoomChanged={() => setFollowBus(false)}
					disableDefaultUI={true}
					rotateControl={false}
					mapTypeControl={false}
					streetViewControl={false}
					fullscreenControl={false}
					onClick={() => setClickedOutside(true)}
					colorScheme="DARK"
					reuseMaps={true}
					restriction={{
						latLngBounds: { north: 60, south: 58.5, east: 18.5, west: 17.5 },
					}}
					minZoom={8}
				>
					<MapControl
						position={
							zoomWindowLevel > 100
								? ControlPosition.INLINE_END_BLOCK_CENTER
								: ControlPosition.INLINE_END_BLOCK_START
						}
					>
						<MapControlButtons
							googleMapRef={mapRef}
							zoomIn={zoomIn}
							zoomOut={zoomOut}
							setShowCurrentTrips={setShowCurrentTrips}
							showCurrentTrips={showCurrentTrips}
							filteredVehicles={filteredVehicles}
							setFollowBus={setFollowBus}
							followBus={followBus}
							activeMarker={activeMarkerId !== null}
						/>
					</MapControl>
					{filteredVehicles?.map((vehicle) => (
						<CustomMarker
							googleMapRef={mapRef}
							clickedOutside={clickedOutside}
							setClickedOutside={setClickedOutside}
							currentVehicle={vehicle}
							lastStops={lastStops}
							setInfoWindowActiveExternal={setInfoWindowActive}
							infoWindowActiveExternal={infoWindowActive}
							followBus={followBus}
							setFollowBus={setFollowBus}
							isActive={activeMarkerId === vehicle?.vehicle?.id}
							onActivateMarker={(id) => setActiveMarkerId(id)}
							key={vehicle.vehicle.id}
							id={vehicle.vehicle.id}
							position={{
								lat: vehicle.position.latitude,
								lng: vehicle.position.longitude,
							}}
						/>
					))}{" "}
					{filteredVehicles?.length > 0 && showCurrentTrips && (
						<CurrentTrips lastStops={lastStops} />
					)}
					{userLocation && google.maps.LatLng && (
						<AdvancedMarker
							className="user-location"
							title={"Din position"}
							position={
								new google.maps.LatLng({
									lat: userLocation.coords.latitude,
									lng: userLocation.coords.longitude,
								})
							}
						>
							<div> </div>
						</AdvancedMarker>
					)}
				</GoogleMap>
			</APIProvider>
		</div>
	);
}
