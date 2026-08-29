import type { IDbData } from "@shared/models/IDbData";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	ensureDeviceCompassListening,
	needsDeviceOrientationPermission,
	subscribeDeviceCompass,
} from "../utilities/deviceCompassHeading";
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
/** Över denna hastighet prioriteras GPS-riktning framför kompassen. */
const GPS_HEADING_PREFERRED_SPEED_MPS = 1;

export function useGeolocation(
	lineStops: IDbData[],
	currentTrips: IDbData[],
): [IUser | null, Dispatch<SetStateAction<IUser | null>>] {
	const [position, setPosition] = useState<IUser | null>(null);
	const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
	const lastHeadingRef = useRef<number | null>(null);
	const gpsHeadingRef = useRef<number | null>(null);
	const compassHeadingRef = useRef<number | null>(null);
	const lastSpeedRef = useRef<number | null>(null);
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

	const resolveHeading = useCallback((): number | null => {
		const gpsHeading = gpsHeadingRef.current;
		const compassHeading = compassHeadingRef.current;
		const speed = lastSpeedRef.current;
		const moving =
			speed != null &&
			Number.isFinite(speed) &&
			speed >= GPS_HEADING_PREFERRED_SPEED_MPS;

		if (moving && gpsHeading != null) return gpsHeading;
		if (compassHeading != null) return compassHeading;
		return gpsHeading ?? lastHeadingRef.current;
	}, []);

	const applyHeadingRef = useRef<
		(
			heading: number | null,
			options?: { lat?: number; lng?: number; epsilon?: number },
		) => void
	>(() => {});

	useEffect(() => {
		applyHeadingRef.current = (
			heading: number | null,
			options?: { lat?: number; lng?: number; epsilon?: number },
		) => {
			if (heading == null) return;

			const fromGps = options?.lat != null && options?.lng != null;
			const smoothed = smoothHeading(
				lastHeadingRef.current,
				heading,
				fromGps ? 0.35 : 0.55,
				options?.epsilon ?? (fromGps ? 5 : 2),
			);
			lastHeadingRef.current = smoothed;

			if (fromGps) {
				computeUserPosition(
					options.lat as number,
					options.lng as number,
					smoothed,
				);
				return;
			}

			setPosition((prev) => {
				if (!prev) return prev;
				const epsilon = options?.epsilon ?? 2;
				if (
					prev.heading === smoothed ||
					(prev.heading != null &&
						Math.abs(shortestAngleDelta(prev.heading, smoothed)) < epsilon)
				) {
					return prev;
				}
				return { ...prev, heading: smoothed };
			});
		};
	}, [computeUserPosition]);

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
			const { latitude, longitude, heading: rawHeading, speed } = pos.coords;
			lastSpeedRef.current = speed;

			let gpsHeading =
				rawHeading != null && !Number.isNaN(rawHeading) ? rawHeading : null;

			const last = lastCoordsRef.current;
			if (gpsHeading === null && last) {
				const movedMeters = getDistanceFromLatLon(
					last.lat,
					last.lng,
					latitude,
					longitude,
				);
				if (movedMeters >= MIN_MOVEMENT_FOR_BEARING_METERS) {
					gpsHeading = getBearingFromLatLon(
						last.lat,
						last.lng,
						latitude,
						longitude,
					);
				}
			}

			gpsHeadingRef.current = gpsHeading;
			applyHeadingRef.current(resolveHeading(), {
				lat: latitude,
				lng: longitude,
			});
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
	}, [resolveHeading]);

	useEffect(() => {
		const onCompassHeading = (heading: number) => {
			compassHeadingRef.current = heading;
			applyHeadingRef.current(resolveHeading());
		};

		const unsubscribe = subscribeDeviceCompass(onCompassHeading);

		if (!needsDeviceOrientationPermission()) {
			void ensureDeviceCompassListening();
			return unsubscribe;
		}

		const enableOnGesture = () => {
			void ensureDeviceCompassListening();
		};

		window.addEventListener("click", enableOnGesture, {
			once: true,
			capture: true,
		});
		window.addEventListener("touchstart", enableOnGesture, {
			once: true,
			capture: true,
		});

		return () => {
			unsubscribe();
			window.removeEventListener("click", enableOnGesture, { capture: true });
			window.removeEventListener("touchstart", enableOnGesture, {
				capture: true,
			});
		};
	}, [resolveHeading]);

	return [position, setPosition];
}
