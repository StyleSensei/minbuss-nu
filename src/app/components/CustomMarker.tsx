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

interface ICustomMarkerProps {
	position: { lat: number; lng: number };
	currentVehicle: IVehiclePosition;
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	clickedOutside: boolean;
	setClickedOutside: (value: boolean) => void;
	id: string | null;
	lastStops: IDbData[];
	infoWindowActiveExternal: boolean;
	setInfoWindowActiveExternal: (value: boolean) => void;
	followBus: boolean;
	setFollowBus: (value: boolean) => void;
	isActive: boolean;
	onActivateMarker: (id: string | null) => void;
}

export default function CustomMarker({
	googleMapRef,
	position,
	currentVehicle,
	clickedOutside,
	setClickedOutside,
	id,
	lastStops,
	infoWindowActiveExternal,
	setInfoWindowActiveExternal,
	followBus,
	setFollowBus,
	isActive,
	onActivateMarker,
}: ICustomMarkerProps) {
	const [markerRef, marker] = useAdvancedMarkerRef();

	const [closestStopState, setClosestStop] = useState<IDbData | null>(null);
	const [passedStops, setPassedStops] = useState<Map<string, IDbData>>(
		new Map(),
	);
	const [currentBus, setCurrentBus] = useState<IVehiclePosition | undefined>(
		currentVehicle,
	);
	const { filteredVehicles, cachedDbDataState } = useDataContext();
	const previousDistanceRef = useRef<number | null>(null);
	const [hasPassedStop, setHasPassedStop] = useState(false);
	const [infoWindowActive, setInfoWindowActive] = useState(
		infoWindowActiveExternal,
	);

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

	// @see https://www.geeksforgeeks.org/haversine-formula-to-find-distance-between-two-points-on-a-sphere/
	const getDistanceFromLatLon = useCallback(
		(lat1: number, lon1: number, lat2: number, lon2: number) => {
			const convertLatLonToRadians = (degree: number) =>
				degree * (Math.PI / 180);

			const EARTH_RADIUS_METERS = 6371000;
			const radianForLat1 = convertLatLonToRadians(lat1);
			const radianForLat2 = convertLatLonToRadians(lat2);
			const deltaLat = convertLatLonToRadians(lat2 - lat1);
			const deltaLon = convertLatLonToRadians(lon2 - lon1);

			// Haversine formula
			const a =
				Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
				Math.cos(radianForLat1) *
					Math.cos(radianForLat2) *
					Math.sin(deltaLon / 2) *
					Math.sin(deltaLon / 2);
			const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			const distance = EARTH_RADIUS_METERS * angularDistance; // Distance in meters
			return distance;
		},
		[],
	);

	const checkIfCloserOrFurtherFromStop = useCallback(() => {
		if (!currentBus || !closestStopState || !infoWindowActive) return;
		const busPosition = currentBus?.position;
		const currentDistance = getDistanceFromLatLon(
			busPosition.latitude,
			busPosition.longitude,
			closestStopState.stop_lat,
			closestStopState.stop_lon,
		);

		if (
			previousDistanceRef.current === null ||
			currentDistance < previousDistanceRef.current
		) {
			// console.log("bus is getting closer to the stop");
			previousDistanceRef.current = currentDistance;
		}
		if (currentDistance > previousDistanceRef.current) {
			// console.log("bus is getting further from the stop");
			previousDistanceRef.current = null;
			setHasPassedStop(true);
		}
	}, [currentBus, getDistanceFromLatLon, infoWindowActive, closestStopState]);

	const getClosest = useCallback(
		(
			list: IDbData[] | IVehiclePosition[],
			latitude: number,
			longitude: number,
		) => {
			const closest = list.reduce((prev, current) => {
				const prevLat =
					"stop_id" in prev ? prev.stop_lat : prev.position.latitude;
				const prevLon =
					"stop_id" in prev ? prev.stop_lon : prev.position.longitude;
				const currentLat =
					"stop_id" in current ? current.stop_lat : current.position.latitude;
				const currentLon =
					"stop_id" in current ? current.stop_lon : current.position.longitude;
				const prevDistance = getDistanceFromLatLon(
					latitude,
					longitude,
					prevLat,
					prevLon,
				);
				const currentDistance = getDistanceFromLatLon(
					latitude,
					longitude,
					currentLat,
					currentLon,
				);
				return currentDistance < prevDistance ? current : prev;
			});
			return closest;
		},
		[getDistanceFromLatLon],
	);

	const findCurrentStopSequence = useCallback(() => {
		if (!currentBus) return null;

		const busLat = currentBus.position.latitude;
		const busLon = currentBus.position.longitude;

		const stopsOnTrip = cachedDbDataState
			.filter((stop) => stop.trip_id === currentBus.trip.tripId)
			.sort((a, b) => a.stop_sequence - b.stop_sequence);

		if (stopsOnTrip.length === 0) return null;

		const closestStop = getClosest(stopsOnTrip, busLat, busLon) as IDbData;

		return closestStop.stop_sequence;
	}, [currentBus, cachedDbDataState, getClosest]);

	const findClosestOrNextStop = useCallback(() => {
		if (!currentBus) return null;

		const busPosition = currentBus.position;
		const busLat = busPosition.latitude;
		const busLon = busPosition.longitude;

		let sequenceToBeCompared = 0;
		if (closestStopState) {
			sequenceToBeCompared = closestStopState.stop_sequence;
		} else {
			const currentStopSequence = findCurrentStopSequence();
			if (currentStopSequence) {
				sequenceToBeCompared = currentStopSequence;
			}
		}

		const possibleStops = cachedDbDataState.filter(
			(stop) =>
				stop.trip_id === currentBus?.trip.tripId &&
				stop.stop_sequence >= sequenceToBeCompared &&
				!passedStops.has(stop.stop_id),
		);
		if (possibleStops.length === 0) return null;

		const closestStop = getClosest(possibleStops, busLat, busLon) as IDbData;

		const nextStop = cachedDbDataState.find(
			(stop) =>
				stop.trip_id === currentBus?.trip.tripId &&
				closestStopState &&
				stop.stop_sequence === closestStopState.stop_sequence + 1,
		);

		return { closestStop, nextStop };
	}, [
		cachedDbDataState,
		closestStopState,
		passedStops,
		currentBus,
		findCurrentStopSequence,
		getClosest,
	]);
	const findPassedStops = useCallback(() => {
		if (!currentBus) return;
		const busPosition = currentBus?.position;
		const busLat = busPosition?.latitude;
		const busLon = busPosition?.longitude;

		const passedStop = cachedDbDataState.find((stop) => {
			const distance = getDistanceFromLatLon(
				busLat,
				busLon,
				stop.stop_lat,
				stop.stop_lon,
			);
			return (
				stop.trip_id === currentBus?.trip.tripId &&
				distance < 5 &&
				!passedStops.has(stop.stop_id) &&
				closestStopState &&
				stop.stop_sequence < closestStopState.stop_sequence
			);
		});
		if (passedStop) {
			setPassedStops((prev) =>
				new Map(prev).set(passedStop.stop_id, passedStop),
			);
			const closestOrNextStop = findClosestOrNextStop();
			if (closestOrNextStop?.nextStop) {
				setClosestStop(closestOrNextStop.nextStop);
			}
		}
	}, [
		cachedDbDataState,
		getDistanceFromLatLon,
		currentBus,
		passedStops,
		findClosestOrNextStop,
		closestStopState,
	]);

	const findCurrentBus = useCallback(() => {
		if (!infoWindowActive || !marker?.position) return;
		const markerLat = +marker.position.lat;
		const markerLng = +marker.position.lng;
		const closestBus = getClosest(
			filteredVehicles,
			markerLat,
			markerLng,
		) as IVehiclePosition;
		if (closestBus) setCurrentBus(closestBus);
		return closestBus as IVehiclePosition;
	}, [filteredVehicles, getClosest, infoWindowActive, marker]);

	const handleOnClick = () => {
		if (currentBus) onActivateMarker(isActive ? null : currentBus?.vehicle?.id);
		setClickedOutside(false);
		setInfoWindowActive(!infoWindowActive);
		if (googleMapRef.current) {
			setZoom(googleMapRef.current);
			panTo(googleMapRef.current);
		}
		if (!infoWindowActive) {
			setPassedStops(new Map());
			setHasPassedStop(false);
		} else {
			setClosestStop(null);
		}
	};

	const centerMap = useCallback(
		(GoogleMap: google.maps.Map) => {
			if (currentBus?.vehicle.id === id) {
				const currentCenter = GoogleMap.getCenter();

				const from = {
					lat: currentCenter?.lat(),
					lng: currentCenter?.lng(),
				};
				const to = {
					lat: currentBus.position.latitude,
					lng: currentBus.position.longitude,
				};
				gsap.to(from, {
					duration: 4,
					ease: "sine",
					lat: to.lat,
					lng: to.lng,
					onUpdate: () => {
						from.lat &&
							GoogleMap.setCenter(new google.maps.LatLng(from.lat, from.lng));
					},
				});
			}
		},
		[currentBus, id],
	);

	const panTo = useCallback(
		(GoogleMap: google.maps.Map) => {
			if (marker?.position) {
				GoogleMap.panTo(marker.position);
			}
		},
		[marker],
	);

	const setZoom = useCallback((GoogleMap: google.maps.Map) => {
		GoogleMap.setZoom(17);
	}, []);

	useEffect(() => {
		if (
			followBus &&
			googleMapRef.current &&
			filteredVehicles.length > 0 &&
			currentBus
		) {
			centerMap(googleMapRef.current);
		}
	}, [followBus, centerMap, googleMapRef, filteredVehicles, currentBus]);

	useEffect(() => {
		checkIfCloserOrFurtherFromStop();
	}, [checkIfCloserOrFurtherFromStop]);

	useEffect(() => {
		if (infoWindowActive) {
			setInfoWindowActiveExternal(true);
		}
		if (!infoWindowActive) {
			setInfoWindowActiveExternal(false);
		}
	}, [infoWindowActive, setInfoWindowActiveExternal]);

	useEffect(() => {
		if (filteredVehicles.length === 0 || !infoWindowActive) return;
		setCurrentBus(findCurrentBus());
		if (clickedOutside) {
			setInfoWindowActive(false);
			setFollowBus(false);
			onActivateMarker(null);
		}

		const closestOrNextStop = findClosestOrNextStop();
		const closestStop = closestOrNextStop?.closestStop;
		const nextStop = closestOrNextStop?.nextStop;

		let isUpdatingStop = false;

		if (hasPassedStop) {
			if (nextStop) {
				setClosestStop(nextStop);
			} else {
				// console.log("no next stop");
			}
			setHasPassedStop(false);
			isUpdatingStop = true;
		} else {
			if (closestStop && closestStop.stop_id !== closestStopState?.stop_id) {
				setClosestStop(closestStop);
			}
		}
		if (!isUpdatingStop) {
			findPassedStops();
		}
	}, [
		closestStopState,
		filteredVehicles,
		findClosestOrNextStop,
		infoWindowActive,
		hasPassedStop,
		findCurrentBus,
		findPassedStops,
		clickedOutside,
		setFollowBus,
		onActivateMarker,
	]);

	return (
		<>
			<AdvancedMarker
				ref={markerRef}
				position={marker?.position}
				anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
				className={isActive ? "custom-marker --active" : "custom-marker"}
				title={`${lastStops.find((stop) => stop?.trip_id === currentVehicle?.trip?.tripId)?.route_short_name} ,${lastStops.find((stop) => stop?.trip_id === currentVehicle?.trip?.tripId)?.stop_headsign}`}
				onClick={() => (googleMapRef.current ? handleOnClick() : null)}
			>
				<div> </div> {/* prevent standard marker from rendering */}
			</AdvancedMarker>
			{isActive && <InfoWindow closestStopState={closestStopState} />}
		</>
	);
}
