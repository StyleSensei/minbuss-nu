"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	useAdvancedMarkerRef,
	Map as GoogleMap,
} from "@vis.gl/react-google-maps";
import {
	type MutableRefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useDataContext } from "../context/DataContext";
import type { IDbData } from "../models/IDbData";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import { InfoWindow } from "./InfoWindow";
import { getClosest } from "../utilities/getClosest";
import { useCheckIfFurtherFromStop } from "../hooks/useCheckIfFurther";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSetZoom } from "../hooks/useSetZoom";

interface ICustomMarkerProps {
	position: { lat: number; lng: number };
	currentVehicle: IVehiclePosition;
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	clickedOutside: boolean;
	setClickedOutside: (value: boolean) => void;
	infoWindowActiveExternal: boolean;
	setInfoWindowActiveExternal: (value: boolean) => void;
	followBus: boolean;
	setFollowBus: (value: boolean) => void;
	isActive: boolean;
	showCurrentTrips: boolean;
	onActivateMarker: (id: string | null) => void;
}

export default function CustomMarker({
	googleMapRef,
	position,
	currentVehicle,
	clickedOutside,
	setClickedOutside,
	infoWindowActiveExternal,
	setInfoWindowActiveExternal,
	followBus,
	setFollowBus,
	isActive,
	showCurrentTrips,
	onActivateMarker,
}: ICustomMarkerProps) {
	const [markerRef, marker] = useAdvancedMarkerRef();
	const [closestStopState, setClosestStop] = useState<IDbData | null>(null);
	const [currentBus, setCurrentBus] = useState<IVehiclePosition | undefined>(
		currentVehicle,
	);
	const { filteredVehicles, cachedDbDataState } = useDataContext();
	const [infoWindowActive, setInfoWindowActive] = useState(
		infoWindowActiveExternal,
	);
	const isMobile = useIsMobile();
	const checkIfFurtherFromStop = useCheckIfFurtherFromStop();
	const setZoom = useSetZoom();
	const zoomRef = useRef<number>(8);

	useGSAP(() => {
		if (marker) {
			const currentPosition = marker.position
				? { lat: marker.position.lat, lng: marker.position.lng }
				: position;
			gsap.to(currentPosition, {
				duration: 4,
				ease: "sine",
				lat: position.lat,
				lng: position.lng,
				onUpdate: () => {
					if (marker) {
						marker.position = new google.maps.LatLng(
							+currentPosition.lat,
							+currentPosition.lng,
						);
					}
				},
			});
		}
	}, [position, marker]);

	const findClosestOrNextStop = useCallback(() => {
		if (!currentBus) return null;

		const busLat = currentBus.position.latitude;
		const busLon = currentBus.position.longitude;

		const stopsOnTrip = cachedDbDataState
			.filter((stop) => stop.trip_id === currentBus.trip.tripId)
			.sort((a, b) => a.stop_sequence - b.stop_sequence);

		if (stopsOnTrip.length === 0) return null;

		const closestStop = getClosest(stopsOnTrip, busLat, busLon) as IDbData;

		const isMovingAway = checkIfFurtherFromStop(currentBus, closestStop, true);

		const nextStop = stopsOnTrip.find(
			(stop) => stop.stop_sequence > closestStop.stop_sequence,
		);

		if (isMovingAway && nextStop) {
			return {
				closestStop: nextStop,
				nextStop: stopsOnTrip.find(
					(stop) => stop.stop_sequence > nextStop.stop_sequence,
				),
			};
		}

		return {
			closestStop,
			nextStop,
		};
	}, [cachedDbDataState, currentBus, checkIfFurtherFromStop]);

	const findCurrentBus = useCallback(() => {
		if (!infoWindowActive || !marker?.position) return;
		const markerLat = +marker.position.lat;
		const markerLng = +marker.position.lng;
		const closestBus = getClosest(
			filteredVehicles,
			markerLat,
			markerLng,
		) as IVehiclePosition;
		return closestBus as IVehiclePosition;
	}, [filteredVehicles, infoWindowActive, marker]);

	const handleOnClick = () => {
		if (followBus) return;
		if (currentBus) onActivateMarker(isActive ? null : currentBus?.vehicle?.id);
		setClickedOutside(false);
		setInfoWindowActive(!infoWindowActive);
		if (googleMapRef.current) {
			setZoom(googleMapRef.current);
			panTo(googleMapRef.current);
		}
	};

	useGSAP(() => {
		if (marker && followBus && isActive) {
			const currentPosition = marker.position
				? { lat: marker.position.lat, lng: marker.position.lng }
				: position;
			gsap.to(currentPosition, {
				duration: 4,
				ease: "sine",
				lat: position.lat,
				lng: position.lng,
				onUpdate: () => {
					googleMapRef.current?.setCenter(
						new google.maps.LatLng(+currentPosition.lat, +currentPosition.lng),
					);
				},
			});
		}
	}, [position, marker, isActive, followBus, googleMapRef]);

	const panTo = useCallback(
		(GoogleMap: google.maps.Map) => {
			if (marker?.position) {
				GoogleMap.panTo(marker.position);
			}
		},
		[marker],
	);

	useEffect(() => {
		if (isActive && currentBus) {
			const closestOrNextStop = findClosestOrNextStop();

			if (closestOrNextStop?.closestStop) {
				setClosestStop(closestOrNextStop.closestStop);
			}
		}
	}, [isActive, currentBus, findClosestOrNextStop]);

	useEffect(() => {
		if (infoWindowActive) {
			setInfoWindowActiveExternal(true);
		}
		if (!infoWindowActive) {
			setInfoWindowActiveExternal(false);
		}
	}, [infoWindowActive, setInfoWindowActiveExternal]);

	useEffect(() => {
		if (clickedOutside) {
			setInfoWindowActive(false);
			setFollowBus(false);
			onActivateMarker(null);
			return;
		}
	}, [clickedOutside, setFollowBus, onActivateMarker]);

	useEffect(() => {
		if (filteredVehicles.length === 0 || !infoWindowActive) return;
		const updatedBus = findCurrentBus();
		if (updatedBus && updatedBus.vehicle.id === currentBus?.vehicle.id) {
			setCurrentBus(updatedBus);
			return;
		}
	}, [filteredVehicles, findCurrentBus, infoWindowActive, currentBus]);

	useEffect(() => {
		if (!currentBus || !infoWindowActive) return;
		const closestOrNextStop = findClosestOrNextStop();
		if (closestOrNextStop?.closestStop) {
			setClosestStop(closestOrNextStop.closestStop);
		}
	}, [currentBus, infoWindowActive, findClosestOrNextStop]);

	useEffect(() => {
		if (filteredVehicles.length) {
			if (googleMapRef.current) {
				const listener = google.maps.event.addListener(
					googleMapRef.current,
					"zoom_changed",
					() => {
						const newZoom = googleMapRef.current?.getZoom() || 8;
						if (newZoom !== zoomRef.current) {
							zoomRef.current = newZoom;
						}
					},
				);

				return () => {
					if (listener) {
						google.maps.event.removeListener(listener);
					}
				};
			}
		}
	}, [filteredVehicles, googleMapRef]);

	return (
		<>
			<AdvancedMarker
				ref={markerRef}
				position={marker?.position}
				anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
				className={isActive ? "custom-marker --active" : "custom-marker"}
				title={`${cachedDbDataState.find((stop) => stop?.trip_id === currentVehicle?.trip?.tripId)?.route_short_name} ,${cachedDbDataState.find((stop) => stop?.trip_id === currentVehicle?.trip?.tripId)?.stop_headsign}`}
				onClick={() => (googleMapRef.current ? handleOnClick() : null)}
				style={
					zoomRef?.current < 11
						? {
								width: zoomRef.current * 1.5,
								height: zoomRef.current * 1.5,
							}
						: undefined
				}
			>
				<div> </div> {/* prevent standard marker from rendering */}
			</AdvancedMarker>
			{isActive && !showCurrentTrips && isMobile && (
				<InfoWindow
					closestStopState={closestStopState}
					tripId={currentBus?.trip.tripId ?? undefined}
				/>
			)}
			{isActive && !isMobile && (
				<InfoWindow
					closestStopState={closestStopState}
					tripId={currentBus?.trip.tripId ?? undefined}
				/>
			)}
		</>
	);
}
