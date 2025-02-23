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
	use,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useDataContext } from "../context/DataContext";
import type { IDbData } from "../models/IDbData";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import { InfoWindow } from "./InfoWindow";
import useUserPosition from "../hooks/useUserPosition";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { getClosest } from "../utilities/getClosest";
import { useCheckIfFurtherFromStop } from "../hooks/useCheckIfFurther";

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
	const [passedBuses, setPassedBuses] = useState<Map<string, IVehiclePosition>>(
		new Map(),
	);
	const [currentBus, setCurrentBus] = useState<IVehiclePosition | undefined>(
		currentVehicle,
	);
	const { filteredVehicles, cachedDbDataState } = useDataContext();
	const [hasPassedStop, setHasPassedStop] = useState(false);
	const [infoWindowActive, setInfoWindowActive] = useState(
		infoWindowActiveExternal,
	);

	const checkIfFurtherFromStop = useCheckIfFurtherFromStop();

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
	}, [currentBus, cachedDbDataState]);

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
		currentBus,
		passedStops,
		findClosestOrNextStop,
		closestStopState,
	]);

	const findPassedBus = useCallback(() => {
		if (!closestStopState) return;

		const busFound = filteredVehicles.find((bus) => {
			const distance = getDistanceFromLatLon(
				bus.position.latitude,
				bus.position.longitude,
				closestStopState.stop_lat,
				closestStopState.stop_lon,
			);
			return (
				distance < 5 &&
				bus.vehicle.id &&
				!passedBuses.has(bus?.vehicle?.id) &&
				bus.trip.tripId === closestStopState.trip_id
			);
		});

		if (busFound) {
			// Lägg till i passedBuses
			setPassedBuses((prev) =>
				new Map(prev).set(busFound?.vehicle?.id, busFound),
			);
		}
	}, [closestStopState, filteredVehicles, passedBuses]);

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
		if (!infoWindowActive) {
			setPassedStops(new Map());
			setHasPassedStop(false);
		} else {
			setClosestStop(null);
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

	const setZoom = useCallback((GoogleMap: google.maps.Map) => {
		GoogleMap.setZoom(17);
	}, []);

	useEffect(() => {
		if (!currentBus || !closestStopState) return;
		const furtherFromStop = checkIfFurtherFromStop(
			currentBus,
			closestStopState,
			infoWindowActive,
		);
		if (furtherFromStop) setHasPassedStop(furtherFromStop);
	}, [checkIfFurtherFromStop, currentBus, closestStopState, infoWindowActive]);

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

		if (clickedOutside) {
			setInfoWindowActive(false);
			setFollowBus(false);
			onActivateMarker(null);
			return;
		}

		const newbus = findCurrentBus();
		if (newbus && newbus.vehicle.id !== currentBus?.vehicle.id) {
			setCurrentBus(newbus);
			return;
		}

		const closestOrNextStop = findClosestOrNextStop();

		if (hasPassedStop && closestOrNextStop?.nextStop) {
			setClosestStop(closestOrNextStop.nextStop);
			setHasPassedStop(false);
		} else if (
			closestOrNextStop?.closestStop &&
			closestOrNextStop.closestStop.stop_id !== closestStopState?.stop_id
		) {
			setClosestStop(closestOrNextStop.closestStop);
		} else {
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
		currentBus,
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
