import { useCallback, useEffect, useRef, useState } from "react";
import type { IDbData } from "@shared/models/IDbData";
import { getClosest } from "../utilities/getClosest";

export interface IUser {
	lat: number;
	lng: number;
	closestStop: IDbData | null;
	tripsAtClosestStop: IDbData[];
}

export function useGeolocation(
	lineStops: IDbData[],
	currentTrips: IDbData[],
) {
	const [position, setPosition] = useState<IUser | null>(null);
	const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

	const computeUserPosition = useCallback(
		(lat: number, lng: number) => {
			lastCoordsRef.current = { lat, lng };

			// Prefer active-trip stops when available so closest stop matches
			// currently active route patterns/directions on the map.
			const activeTripStops = Array.from(
				new Map(
					currentTrips
						.filter((stop) => stop.stop_id)
						.map((stop) => [stop.stop_id, stop] as const),
				).values(),
			);
			const candidateStops =
				activeTripStops.length > 0 ? activeTripStops : lineStops;

			const newClosestStop =
				candidateStops.length > 0
					? (getClosest(candidateStops, lat, lng) as IDbData)
					: null;

			setPosition({
				lat,
				lng,
				closestStop: newClosestStop,
				tripsAtClosestStop: currentTrips.filter(
					(stop) => stop.stop_name === newClosestStop?.stop_name,
				),
			});
		},
		[lineStops, currentTrips],
	);

	useEffect(() => {
		const last = lastCoordsRef.current;
		if (last) {
			computeUserPosition(last.lat, last.lng);
		}
	}, [computeUserPosition]);

	useEffect(() => {
		if (!navigator.geolocation) {
			console.error("Geolocation is not supported by this browser.");
			return;
		}

		const updateUserPosition = (pos: GeolocationPosition) => {
			const { latitude, longitude } = pos.coords;
			computeUserPosition(latitude, longitude);
		};

		const errorHandler = (error: GeolocationPositionError) => {
			console.error("Error getting location:", error.message);
		};

		const watchId = navigator.geolocation.watchPosition(
			updateUserPosition,
			errorHandler,
			{ enableHighAccuracy: true, maximumAge: 0 },
		);

		return () => navigator.geolocation.clearWatch(watchId);
	}, [computeUserPosition]);

	return position;
}
