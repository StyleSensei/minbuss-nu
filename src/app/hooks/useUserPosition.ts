import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { IDbData } from "@shared/models/IDbData";
import { getBearingFromLatLon } from "../utilities/getBearingFromLatLon";
import { getClosest } from "../utilities/getClosest";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { shortestAngleDelta, smoothHeading } from "../utilities/headingMath";

export interface IUser {
	lat: number;
	lng: number;
	/** Compass heading in degrees (0 = north, clockwise). Null when unknown. */
	heading: number | null;
	closestStop: IDbData | null;
	tripsAtClosestStop: IDbData[];
}

/** ~2.5 m — under detta hoppar vi setState så kartan inte renderas om i onödan vid GPS-bruset. */
const COORD_EPS = 0.000025;
/** Minst så här långt måste användaren ha förflyttat sig för att vi ska räkna ut riktning. */
const MIN_MOVEMENT_FOR_BEARING_METERS = 3;

export function useGeolocation(
	lineStops: IDbData[],
	currentTrips: IDbData[],
): [IUser | null, Dispatch<SetStateAction<IUser | null>>] {
	const [position, setPosition] = useState<IUser | null>(null);
	const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
	const lastHeadingRef = useRef<number | null>(null);
	const lineStopsRef = useRef(lineStops);
	const currentTripsRef = useRef(currentTrips);
	lineStopsRef.current = lineStops;
	currentTripsRef.current = currentTrips;

	const computeUserPosition = useCallback(
		(lat: number, lng: number, heading: number | null) => {
			const trips = currentTripsRef.current;
			const stops = lineStopsRef.current;
			lastCoordsRef.current = { lat, lng };

			// Prefer active-trip stops when available so closest stop matches
			// currently active route patterns/directions on the map.
			const activeTripStops = Array.from(
				new Map(
					trips
						.filter((stop) => stop.stop_id)
						.map((stop) => [stop.stop_id, stop] as const),
				).values(),
			);
			const candidateStops =
				activeTripStops.length > 0 ? activeTripStops : stops;

			const newClosestStop =
				candidateStops.length > 0
					? (getClosest(candidateStops, lat, lng) as IDbData)
					: null;

			const tripsAtClosestStop = trips.filter(
				(stop) => stop.stop_name === newClosestStop?.stop_name,
			);
			const tripsSig = tripsAtClosestStop
				.map((t) => `${t.trip_id}:${t.stop_id}:${t.stop_sequence}`)
				.join("|");

			setPosition((prev) => {
				if (prev) {
					const sameStop =
						prev.closestStop?.stop_id === newClosestStop?.stop_id;
					const sameCoords =
						Math.abs(prev.lat - lat) < COORD_EPS &&
						Math.abs(prev.lng - lng) < COORD_EPS;
					const sameHeading =
						prev.heading === heading ||
						(prev.heading != null &&
							heading != null &&
							Math.abs(shortestAngleDelta(prev.heading, heading)) < 5);
					const prevTripsSig = prev.tripsAtClosestStop
						.map((t) => `${t.trip_id}:${t.stop_id}:${t.stop_sequence}`)
						.join("|");
					if (
						sameStop &&
						sameCoords &&
						sameHeading &&
						prevTripsSig === tripsSig
					) {
						return prev;
					}
				}
				return {
					lat,
					lng,
					heading,
					closestStop: newClosestStop,
					tripsAtClosestStop,
				};
			});
		},
		[],
	);

	/** Primitiv nyckel — undvik [lineStops, currentTrips] (nya []-referenser varje render → effect-storm). */
	const geoDataKey = `${lineStops.length}|${currentTrips.length}|${lineStops[0]?.stop_id ?? ""}|${currentTrips[0]?.trip_id ?? ""}`;

	useEffect(() => {
		const last = lastCoordsRef.current;
		if (last) {
			computeUserPosition(last.lat, last.lng, lastHeadingRef.current);
		}
	}, [geoDataKey, computeUserPosition]);

	useEffect(() => {
		if (!navigator.geolocation) {
			console.error("Geolocation is not supported by this browser.");
			return;
		}

		const updateUserPosition = (pos: GeolocationPosition) => {
			const { latitude, longitude, heading: rawHeading } = pos.coords;
			let heading =
				rawHeading != null && !Number.isNaN(rawHeading) ? rawHeading : null;

			const last = lastCoordsRef.current;
			if (heading === null && last) {
				const movedMeters = getDistanceFromLatLon(
					last.lat,
					last.lng,
					latitude,
					longitude,
				);
				if (movedMeters >= MIN_MOVEMENT_FOR_BEARING_METERS) {
					heading = getBearingFromLatLon(
						last.lat,
						last.lng,
						latitude,
						longitude,
					);
				}
			}

			const resolvedHeading = heading ?? lastHeadingRef.current;
			const smoothedHeading =
				resolvedHeading != null
					? smoothHeading(lastHeadingRef.current, resolvedHeading)
					: null;
			if (smoothedHeading != null) {
				lastHeadingRef.current = smoothedHeading;
			}

			computeUserPosition(latitude, longitude, smoothedHeading);
		};

		const errorHandler = (error: GeolocationPositionError) => {
			console.error("Error getting location:", error.message);
		};

		const watchId = navigator.geolocation.watchPosition(
			updateUserPosition,
			errorHandler,
			{
				enableHighAccuracy: true,
				// Undvik att spamma React/state vid små GPS-rörelser (kartan blev seg).
				maximumAge: 5000,
			},
		);

		return () => navigator.geolocation.clearWatch(watchId);
	}, [computeUserPosition]);

	return [position, setPosition];
}
