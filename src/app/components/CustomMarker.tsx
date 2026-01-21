"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import {
	type MutableRefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useDataContext } from "../context/DataContext";
import type { IDbData } from "@shared/models/IDbData";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { InfoWindow } from "./InfoWindow";
import { getClosest } from "../utilities/getClosest";
import { useCheckIfFurtherFromStop } from "../hooks/useCheckIfFurther";
import { useSetZoom } from "../hooks/useSetZoom";
import { useIsMobile } from "../hooks/useIsMobile";

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
	const { filteredVehicles, tripData } = useDataContext();
	const [infoWindowActive, setInfoWindowActive] = useState(
		infoWindowActiveExternal,
	);
	const checkIfFurtherFromStop = useCheckIfFurtherFromStop();
	const setZoom = useSetZoom();
	const isMobile = useIsMobile();
	const zoomRef = useRef<number>(8);
	const markerAnimationRef = useRef<gsap.core.Tween | null>(null);
	const followAnimationRef = useRef<gsap.core.Tween | null>(null);

	useGSAP(() => {
		if (marker) {
			if (markerAnimationRef.current) {
				markerAnimationRef.current.kill();
			}

			const currentPosition = marker.position
				? { lat: marker.position.lat, lng: marker.position.lng }
				: position;

			markerAnimationRef.current = gsap.to(currentPosition, {
				duration: 3,
				ease: "linear",
				lat: position.lat,
				lng: position.lng,
				overwrite: "auto",
				lazy: true,
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

		return () => {
			if (markerAnimationRef.current) {
				markerAnimationRef.current.kill();
				markerAnimationRef.current = null;
			}
		};
	}, [position, marker]);

	const findClosestOrNextStop = useCallback(() => {
		if (!currentBus) return null;

		const busLat = currentBus.position.latitude;
		const busLon = currentBus.position.longitude;

		const stopsOnTrip = tripData.currentTrips
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
	}, [tripData.currentTrips, currentBus, checkIfFurtherFromStop]);

	const findCurrentBus = useCallback(() => {
		if (!infoWindowActive || !marker?.position) return;
		const markerLat = +marker.position.lat;
		const markerLng = +marker.position.lng;
		const closestBus = getClosest(
			filteredVehicles.data,
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
			if (followAnimationRef.current) {
				followAnimationRef.current.kill();
			}

			const currentPosition = marker.position
				? { lat: marker.position.lat, lng: marker.position.lng }
				: position;

			followAnimationRef.current = gsap.to(currentPosition, {
				duration: 3,
				ease: "linear",
				lat: position.lat,
				lng: position.lng,
				overwrite: "auto",
				onUpdate: () => {
					googleMapRef.current?.setCenter(
						new google.maps.LatLng(+currentPosition.lat, +currentPosition.lng),
					);
				},
			});
		}

		return () => {
			if (followAnimationRef.current) {
				followAnimationRef.current.kill();
				followAnimationRef.current = null;
			}
		};
	}, [position, marker, isActive, followBus, googleMapRef]);

	useEffect(() => {
		if (!followBus && followAnimationRef.current) {
			followAnimationRef.current.kill();
			followAnimationRef.current = null;
		}
	}, [followBus]);

	useEffect(() => {
		return () => {
			if (markerAnimationRef.current) {
				markerAnimationRef.current.kill();
			}
			if (followAnimationRef.current) {
				followAnimationRef.current.kill();
			}

			if (marker?.position) {
				gsap.killTweensOf(marker.position);
			}
		};
	}, [marker]);

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
		if (filteredVehicles.data.length === 0 || !infoWindowActive) return;
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
		if (filteredVehicles.data.length) {
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

	const matchingStop = tripData.currentTrips.find(
		(stop) => stop.trip_id === currentVehicle?.trip?.tripId,
	);

	const markerTitle = matchingStop
		? `${matchingStop.route_short_name || "Okänd linje"},${matchingStop.stop_headsign || "Okänd destination"}`
		: "Fordon";

	return (
		<>
			<AdvancedMarker
				ref={markerRef}
				position={marker?.position}
				anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
				className="marker-wrapper"
				title={markerTitle}
				onClick={() => (googleMapRef.current ? handleOnClick() : null)}
			>
				<div
					className={`custom-marker ${isActive ? "--active" : ""}`}
					style={
						zoomRef?.current < 11
							? {
									width: zoomRef.current * 1.5,
									height: zoomRef.current * 1.5,
								}
							: undefined
					}
				/>
			</AdvancedMarker>
			{isActive && (
				<InfoWindow
					closestStopState={closestStopState}
					tripId={currentBus?.trip.tripId ?? undefined}
					googleMapRef={googleMapRef}
					style={
						showCurrentTrips && isMobile
							? { display: "none" }
							: { display: "block" }
					}
				/>
			)}
		</>
	);
}
