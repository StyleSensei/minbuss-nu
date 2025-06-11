import type { IDbData } from "@shared/models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import { useDataContext } from "../context/DataContext";
import { Icon } from "./Icon";
import { arrow, earth } from "../../../public/icons";
import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";

interface ICurrentTripsProps {
	onTripSelect?: (tripId: string) => void;
	setShowLoadingTrips: (value: boolean) => void;
}

export const CurrentTrips = ({
	onTripSelect,
	setShowLoadingTrips,
}: ICurrentTripsProps) => {
	const { containerRef, isOverflowing, checkOverflow, isScrolledToBottom } =
		useOverflow();
	const { filteredVehicles, tripData, filteredTripUpdates, userPosition } =
		useDataContext();
	const [dataReady, setDataReady] = useState(false);
	const calculationsCompleteRef = useRef(false);

	useEffect(() => {
		if (filteredVehicles.data.length > 0 && userPosition?.closestStop) {
			calculationsCompleteRef.current = true;
		}
	}, [filteredVehicles.data.length, userPosition?.closestStop]);

	useLayoutEffect(() => {
		if (calculationsCompleteRef.current && !dataReady) {
			const rafId = requestAnimationFrame(() => {
				setDataReady(true);
			});
			return () => cancelAnimationFrame(rafId);
		}
	});

	useEffect(() => {
		if (dataReady) {
			setShowLoadingTrips(false);
		}
	}, [dataReady, setShowLoadingTrips]);

	const now = new Date();
	const currentHours = now.getHours();
	const currentMinutes = now.getMinutes();
	const currentTimeInMinutes = currentHours * 60 + currentMinutes;
	const currentTimeSeconds = Math.floor(Date.now() / 1000);

	const activeVehiclePositions = new Map();
	for (const bus of filteredVehicles.data) {
		activeVehiclePositions.set(bus.trip.tripId, {
			lat: bus.position.latitude,
			lon: bus.position.longitude,
			tripId: bus.trip.tripId,
		});
	}

	function isTripRelevant(trip: IDbData): boolean {
		const [hoursStr, minutes] = trip.departure_time.split(":").map(Number);
		const hours = hoursStr;
		const tripTimeInMinutes = hours * 60 + minutes;

		// Convert current time to GTFS format (may need to add 24h)
		let gtfsCurrentHours = currentHours;
		let gtfsCurrentTimeInMinutes = currentTimeInMinutes;

		// If we're in early hours (after midnight) but the trip time is in "extended day" format (>= 24)
		if (currentHours < 12 && hours >= 24) {
			// We're in the next day in real time, but still in previous service day in GTFS
			// No need to adjust GTFS time, but we need to adjust current time
			gtfsCurrentHours += 24;
			gtfsCurrentTimeInMinutes += 24 * 60;
		}

		const timeDifferenceInMinutes =
			tripTimeInMinutes - gtfsCurrentTimeInMinutes;
		const tripId = trip.trip_id;

		if (timeDifferenceInMinutes <= 0) {
			const tripUpdate = filteredTripUpdates.find(
				(t) => t.trip.tripId === tripId,
			);

			if (!tripUpdate) {
				return timeDifferenceInMinutes >= -1;
			}

			const stopUpdate = tripUpdate.stopTimeUpdate?.find(
				(update) => update.stopId === userPosition?.closestStop?.stop_id,
			);

			if (stopUpdate?.departure?.time) {
				return Number(stopUpdate.departure.time) > currentTimeSeconds;
			}

			return false;
		}

		if (timeDifferenceInMinutes < -15) {
			return activeVehiclePositions.has(tripId);
		}

		return true;
	}

	function getUpdatedDepartureTime(tripId: string): string | undefined {
		if (!filteredTripUpdates.length) return undefined;

		const tripUpdate = filteredTripUpdates.find(
			(t) => t.trip.tripId === tripId,
		);
		if (!tripUpdate) return undefined;

		const stopUpdate = tripUpdate.stopTimeUpdate?.find(
			(update) => update.stopId === userPosition?.closestStop?.stop_id,
		);

		if (!stopUpdate?.departure?.time) return undefined;

		const departureDate = new Date(Number(stopUpdate.departure.time) * 1000);
		return departureDate.toLocaleTimeString().slice(0, 5);
	}

	const allTripsAtUserStop = [...tripData.upcomingTrips];

	const relevantTrips = allTripsAtUserStop
		.filter(isTripRelevant)
		.sort((a, b) => {
			const aHasRealtime = activeVehiclePositions.has(a.trip_id);
			const bHasRealtime = activeVehiclePositions.has(b.trip_id);

			if (aHasRealtime && !bHasRealtime) return -1;
			if (!aHasRealtime && bHasRealtime) return 1;

			return a.departure_time.localeCompare(b.departure_time);
		});

	const uniqueTripsMap = new Map<string, IDbData>();
	for (const trip of relevantTrips) {
		if (!uniqueTripsMap.has(trip.trip_id)) {
			uniqueTripsMap.set(trip.trip_id, trip);
		}
	}

	// Handle extended GTFS day format in sorting (hours can go beyond 24)
	const sortedTrips = [...uniqueTripsMap.values()].sort((a, b) => {
		const [aHoursStr, aMinutesStr] = a.departure_time.split(":");
		const [bHoursStr, bMinutesStr] = b.departure_time.split(":");
		const aHours = Number.parseInt(aHoursStr, 10);
		const bHours = Number.parseInt(bHoursStr, 10);
		const aMinutes = Number.parseInt(aMinutesStr, 10);
		const bMinutes = Number.parseInt(bMinutesStr, 10);

		const aTotalMinutes = aHours * 60 + aMinutes;
		const bTotalMinutes = bHours * 60 + bMinutes;

		return aTotalMinutes - bTotalMinutes;
	});

	let nextBus: IDbData | undefined;
	let rest: IDbData[] = [];

	if (sortedTrips.length > 0) {
		[nextBus, ...rest] = sortedTrips;
	} else if (allTripsAtUserStop.length > 0) {
		const fallbackTrips = [...allTripsAtUserStop]
			.sort((a, b) => a.departure_time.localeCompare(b.departure_time))
			.slice(0, 6);

		if (fallbackTrips.length > 0) {
			[nextBus, ...rest] = fallbackTrips;
		}
	}

	const nextBusUpdatedTime = nextBus
		? getUpdatedDepartureTime(nextBus.trip_id)
		: undefined;

	const nextBusScheduledTime = nextBus?.departure_time
		? normalizeTimeForDisplay(nextBus.departure_time.slice(0, 5))
		: undefined;

	const hasUpdate =
		nextBusUpdatedTime && nextBusUpdatedTime !== nextBusScheduledTime;

	// Ensure data shows even if calculations are slow
	calculationsCompleteRef.current = true;

	const hasTripsToDisplay = nextBus !== undefined;

	useEffect(() => {
		if (hasTripsToDisplay && containerRef.current) {
			setTimeout(() => checkOverflow(), 50);
		}
	}, [hasTripsToDisplay, checkOverflow, containerRef.current]);

	return (
		<div className="current-trips">
			<div
				className={`table-container ${isOverflowing ? "--overflowing" : ""} ${isScrolledToBottom ? "--at-bottom" : ""}`}
				aria-live="polite"
				ref={containerRef}
			>
				<div className="trips-header">
					<h2>Linje: {tripData.currentTrips[0]?.route_short_name}</h2>
					{userPosition && (
						<p className="station-name">
							Din närmaste hållplats:{" "}
							<strong>{userPosition?.closestStop?.stop_name}</strong>
						</p>
					)}
				</div>
				{hasTripsToDisplay ? (
					<>
						<div
							className={`next-departure ${activeVehiclePositions.has(nextBus?.trip_id) ? " --active" : ""}`}
							onClick={() => {
								nextBus ? onTripSelect?.(nextBus.trip_id) : null;
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && onTripSelect && nextBus) {
									onTripSelect(nextBus.trip_id);
								}
							}}
						>
							<p>
								<span className="trip-icon" /> Nästa avgång:
							</p>
							<p className="time">
								<Icon
									path={arrow.pathD}
									title="Mot"
									iconSize="24px"
									fill="whitesmoke"
									className="arrow"
								/>{" "}
								{nextBus?.stop_headsign} –{" "}
								{hasUpdate && <span>{nextBusUpdatedTime} </span>}
								<span className={hasUpdate ? "updated-time" : "scheduled-time"}>
									{nextBusScheduledTime}
								</span>{" "}
							</p>
						</div>
						<table>
							<caption>
								Kommande avgångar från {userPosition?.closestStop?.stop_name}:
							</caption>

							<tbody>
								<tr key="th-row">
									<th />
									<th colSpan={1}>Mot</th>
									<th colSpan={1}>Avgår</th>
								</tr>
								{rest.map((trip, i) => {
									const updatedTime = getUpdatedDepartureTime(trip?.trip_id);
									const scheduledTime = normalizeTimeForDisplay(
										trip?.departure_time?.slice(0, 5),
									);
									const hasUpdate =
										updatedTime && updatedTime !== scheduledTime;

									return (
										<tr
											// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
											key={trip?.trip_id + i}
											onClick={() => onTripSelect?.(trip.trip_id)}
											className={`trip-row${activeVehiclePositions.has(trip.trip_id) ? " --active" : ""}`}
											onKeyDown={(e) => {
												if (e.key === "Enter" && onTripSelect) {
													onTripSelect(trip.trip_id);
												}
											}}
										>
											<td>
												<span className="trip-icon" />
											</td>
											<td key={trip.trip_id}>{trip?.stop_headsign}</td>
											<td>
												{hasUpdate && <span>{updatedTime}</span>}
												<span className={hasUpdate ? "updated-time" : ""}>
													{" "}
													{scheduledTime}{" "}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</>
				) : (
					<p>Inga kommande avgångar att visa.</p>
				)}
			</div>
		</div>
	);
};
