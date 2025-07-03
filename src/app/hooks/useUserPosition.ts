import { useEffect, useState } from "react";
import type { IDbData } from "@shared/models/IDbData";
import { getClosest } from "../utilities/getClosest";

export interface IUser {
	lat: number;
	lng: number;
	closestStop: IDbData | null;
	tripsAtClosestStop: IDbData[];
}

export function useGeolocation(currentTrips: IDbData[]) {
	const [position, setPosition] = useState<IUser | null>(null);

	useEffect(() => {
		if (!navigator.geolocation) {
			console.error("Geolocation is not supported by this browser.");
			return;
		}

		const updateUserPosition = (pos: GeolocationPosition) => {
			const { latitude, longitude } = pos.coords;

			const newClosestStop =
				currentTrips.length > 0
					? (getClosest(currentTrips, latitude, longitude) as IDbData)
					: null;

			setPosition((prev) => {
				if (!prev || prev.lat !== latitude || prev.lng !== longitude) {
					return {
						lat: latitude,
						lng: longitude,
						closestStop: newClosestStop,
						tripsAtClosestStop: currentTrips.filter(
							(stop) => stop.stop_name === newClosestStop?.stop_name,
						),
					};
				}
				return prev;
			});
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
	}, [currentTrips]);

	return position;
}
