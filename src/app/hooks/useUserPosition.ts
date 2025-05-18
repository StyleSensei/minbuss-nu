import { useEffect, useRef, useState } from "react";
import type { IDbData } from "../models/IDbData";
import { getClosest } from "../utilities/getClosest";
import { useDataContext } from "../context/DataContext";

interface IUser {
	lat: number;
	lng: number;
	closestStop: IDbData | null;
	tripsAtClosestStop: IDbData[];
	accuracy: number;
	lastUpdated: number;
}

enum GeolocationState {
	Initializing = "initializing", // Första läget innan någon position
	Available = "available", // Fungerar som förväntat
	Unavailable = "unavailable", // Geolocation stöds inte
	Error = "error", // Permanent fel
	Denied = "denied", // Användaren nekade åtkomst
	Recovering = "recovering", // Tillfälligt fel, försöker återhämta sig
}

const useUserPosition = () => {
	const [userPosition, setUserPosition] = useState<IUser | null>(null);
	const [geoState, setGeoState] = useState<GeolocationState>(
		GeolocationState.Initializing,
	);
	const { cachedDbDataState } = useDataContext();

	const errorCount = useRef(0);
	const lastPosition = useRef<GeolocationPosition | null>(null);

	useEffect(() => {
		if (!navigator.geolocation) {
			console.error("Geolocation is not supported by this browser.");
			setGeoState(GeolocationState.Unavailable);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				updateUserPosition(pos);
				setGeoState(GeolocationState.Available);
				errorCount.current = 0;
			},
			(error) => {
				handlePositionError(error);
			},
			{
				timeout: 10000,
				maximumAge: 30000,
				enableHighAccuracy: false,
			},
		);

		const watchId = navigator.geolocation.watchPosition(
			(pos) => {
				lastPosition.current = pos;
				updateUserPosition(pos);

				if (geoState === GeolocationState.Recovering) {
					setGeoState(GeolocationState.Available);
				}

				errorCount.current = 0;
			},
			(error) => {
				handlePositionError(error);
			},
			{
				enableHighAccuracy: true,
				maximumAge: 0,
				timeout: 15000,
			},
		);

		return () => navigator.geolocation.clearWatch(watchId);
	}, [geoState]);

	const handlePositionError = (error: GeolocationPositionError) => {
		switch (error.code) {
			case error.PERMISSION_DENIED:
				console.warn("Location access denied by user");
				setGeoState(GeolocationState.Denied);
				break;

			case error.POSITION_UNAVAILABLE:
				errorCount.current += 1;

				if (lastPosition.current) {
					console.warn(
						"Position temporarily unavailable, using last known position",
					);
					setGeoState(GeolocationState.Recovering);

					const now = Date.now();
					const posTime = lastPosition.current.timestamp;

					if (now - posTime < 60000) {
						updateUserPosition(lastPosition.current);
					}
				} else if (errorCount.current > 5) {
					console.error("Failed to get position after multiple attempts");
					setGeoState(GeolocationState.Error);
				} else {
					console.warn("Position unavailable, retrying...");
					setGeoState(GeolocationState.Recovering);
				}
				break;

			case error.TIMEOUT:
				console.warn("Position request timed out");
				setGeoState(GeolocationState.Recovering);
				break;

			default:
				console.warn("Unknown location error:", error.message);
				setGeoState(GeolocationState.Recovering);
		}
	};

	const updateUserPosition = (pos: GeolocationPosition) => {
		const { latitude, longitude, accuracy } = pos.coords;

		const newClosestStop =
			cachedDbDataState.length > 0
				? (getClosest(cachedDbDataState, latitude, longitude) as IDbData)
				: null;

		setUserPosition((prev) => {
			const positionChanged =
				!prev ||
				Math.abs(prev.lat - latitude) > 0.0001 ||
				Math.abs(prev.lng - longitude) > 0.0001;

			if (!prev || positionChanged) {
				return {
					lat: latitude,
					lng: longitude,
					accuracy,
					lastUpdated: Date.now(),
					closestStop: newClosestStop,
					tripsAtClosestStop: newClosestStop
						? cachedDbDataState
								.filter((stop) => stop.stop_name === newClosestStop.stop_name)
								.sort((a, b) => a.trip_id.localeCompare(b.trip_id))
						: [],
				};
			}
			return prev;
		});
	};

	return {
		userPosition,
		setUserPosition,
		locationState: geoState,
		isLocationAvailable:
			geoState === GeolocationState.Available || GeolocationState.Recovering,
	};
};

export default useUserPosition;
