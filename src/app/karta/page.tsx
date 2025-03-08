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
import useUserPosition from "../hooks/useUserPosition";
import { CurrentTripsNoGeo } from "../components/CurrentTripsNoGeo";
import { useIsMobile } from "../hooks/useIsMobile";
import { CurrentTrips } from "../components/CurrentTrips";
import { CurrentTripsLoader } from "../components/CurrentTripsLoader";
import UserMessage from "../components/UserMessage";

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
	const [showLoadingTrips, setShowLoadingTrips] = useState(false);

	const { userPosition, setUserPosition } = useUserPosition();
	const isMobile = useIsMobile();

	useEffect(() => {
		if (showCurrentTrips || !showCurrentTrips) {
			setShowLoadingTrips(showCurrentTrips);
		}
	}, [showCurrentTrips]);

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
		const main = document.getElementById("main");
		if (followBus) {
			main?.classList.add("follow-bus-active");
		}
		return () => {
			main?.classList.remove("follow-bus-active");
		};
	}, [followBus]);

	const getTripsByStopId = useCallback(
		(array: IDbData[]) => {
			if (!userPosition?.tripsAtClosestStop) {
				return [];
			}
			return array.filter(
				(item) => item.stop_id === userPosition?.closestStop?.stop_id,
			);
		},
		[userPosition?.closestStop?.stop_id, userPosition?.tripsAtClosestStop],
	);

	useEffect(() => {
		if (!userPosition) return;

		const tripsAtClosestStop = getTripsByStopId(cachedDbDataState);

		if (
			JSON.stringify(tripsAtClosestStop) !==
			JSON.stringify(userPosition.tripsAtClosestStop)
		) {
			setUserPosition((prev) => {
				if (!prev) return null;
				return {
					...prev,
					tripsAtClosestStop,
				};
			});
		}
	}, [cachedDbDataState, getTripsByStopId, userPosition, setUserPosition]);

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

	const handleTripSelect = useCallback(
		(tripId: string) => {
			const vehicle = filteredVehicles.find((v) => v.trip.tripId === tripId);
			if (vehicle) {
				setInfoWindowActive(false);
				setActiveMarkerId(null);

				setTimeout(() => {
					setActiveMarkerId(vehicle.vehicle.id);
					setClickedOutside(false);
					setInfoWindowActive(true);

					if (mapRef.current && vehicle.position) {
						mapRef.current.panTo({
							lat: vehicle.position.latitude,
							lng: vehicle.position.longitude,
						});
					}
					if (isMobile) {
						setShowCurrentTrips(false);
					}
				}, 50);
				mapRef?.current?.setZoom(17);
			}
		},
		[filteredVehicles, isMobile],
	);

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
					style={{ width: "100vw", height: "100dvh", zIndex: "unset" }}
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
						latLngBounds: { north: 60, south: 58.5, east: 20, west: 16.5 },
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
							followBus={activeMarkerId ? followBus : false}
							activeMarker={activeMarkerId !== null}
						/>
					</MapControl>
					{filteredVehicles?.map((vehicle) => (
						<CustomMarker
							googleMapRef={mapRef}
							clickedOutside={clickedOutside}
							setClickedOutside={setClickedOutside}
							currentVehicle={vehicle}
							setInfoWindowActiveExternal={setInfoWindowActive}
							infoWindowActiveExternal={infoWindowActive}
							followBus={followBus}
							setFollowBus={setFollowBus}
							isActive={activeMarkerId === vehicle?.vehicle?.id}
							onActivateMarker={(id) => setActiveMarkerId(id)}
							showCurrentTrips={showCurrentTrips}
							key={vehicle.vehicle.id}
							position={{
								lat: vehicle.position.latitude,
								lng: vehicle.position.longitude,
							}}
						/>
					))}{" "}
					{showLoadingTrips && userPosition && <CurrentTripsLoader />}
					{filteredVehicles?.length > 0 && showCurrentTrips && userPosition && (
						<CurrentTrips
							onTripSelect={handleTripSelect}
							setShowLoadingTrips={setShowLoadingTrips}
						/>
					)}
					{/* {filteredVehicles?.length > 0 &&
						showCurrentTrips &&
						!userPosition && <CurrentTripsNoGeo lastStops={lastStops} />} */}
					{userPosition && google.maps.LatLng && (
						<AdvancedMarker
							className="user-location"
							title={"Din position"}
							position={
								new google.maps.LatLng({
									lat: userPosition.lat,
									lng: userPosition.lng,
								})
							}
						>
							<div> </div>
						</AdvancedMarker>
					)}
				</GoogleMap>
			</APIProvider>
			{!userPosition && <UserMessage />}
		</div>
	);
}
