import type { IDbData } from "@shared/models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import { useDataContext } from "../context/DataContext";
import { Icon } from "./Icon";
import { arrow } from "../../../public/icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import { MapPinned } from "lucide-react";

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
		const [hoursStr, minutesStr] = trip.departure_time.split(":");
		const hours = Number(hoursStr);
		const minutes = Number(minutesStr);
		const tripTimeInMinutes = hours * 60 + minutes;

		// Convert current time to GTFS format (may need to add 24h)
		let gtfsCurrentHours = currentHours;
		let gtfsCurrentTimeInMinutes = currentTimeInMinutes;

		const isAfterMidnight = currentHours >= 0 && currentHours < 4;

		const maxTimeWindowInMinutes = 6 * 60;

		if (isAfterMidnight) {
			// Case 1: We're after midnight (0-4 AM) and trip time is standard format (0-23 hours)
			if (hours < 24) {
				if (
					hours > currentHours ||
					(hours === currentHours && minutes > currentMinutes)
				) {
					const timeDiff =
						(hours - currentHours) * 60 + (minutes - currentMinutes);
					if (timeDiff > maxTimeWindowInMinutes) {
						return false;
					}
					return true;
				}

				const tripUpdate = filteredTripUpdates.find(
					(t) => t.trip.tripId === trip.trip_id,
				);

				if (tripUpdate) {
					const stopUpdate = tripUpdate.stopTimeUpdate?.find(
						(update) => update.stopId === userPosition?.closestStop?.stop_id,
					);

					if (stopUpdate?.departure?.time) {
						return Number(stopUpdate.departure.time) > currentTimeSeconds;
					}
				}

				return activeVehiclePositions.has(trip.trip_id);
			}

			// Case 2: We're after midnight and trip time is in extended format (≥24 hours)
			gtfsCurrentHours += 24;
			gtfsCurrentTimeInMinutes += 24 * 60;
		} else if (hours >= 24) {
			if (process.env.NODE_ENV === "development") {
				console.warn(
					"Found trip with extended hours not after midnight:",
					trip,
				);
			}
			return false;
		}

		const timeDifferenceInMinutes =
			tripTimeInMinutes - gtfsCurrentTimeInMinutes;
		const tripId = trip.trip_id;

		if (
			timeDifferenceInMinutes > 0 &&
			timeDifferenceInMinutes > maxTimeWindowInMinutes
		) {
			if (process.env.NODE_ENV === "development") {
				console.log(
					`Trip filtered - too far in future: ${trip.departure_time}, diff: ${timeDifferenceInMinutes} mins`,
				);
			}
			return false;
		}

		if (
			process.env.NODE_ENV === "development" &&
			Math.abs(timeDifferenceInMinutes) < 30
		) {
			console.log(
				`Trip relevance check: ${trip.departure_time}, diff: ${timeDifferenceInMinutes} mins, ` +
					`hasRealtime: ${activeVehiclePositions.has(tripId)}, ` +
					`tripId: ${tripId.slice(-6)}, after midnight: ${isAfterMidnight}`,
			);
		}

		if (timeDifferenceInMinutes <= 0) {
			if (isAfterMidnight && hours < 24 && timeDifferenceInMinutes < -5) {
				return activeVehiclePositions.has(tripId);
			}

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

			return 0;
		});
	const uniqueTripsMap = new Map<string, IDbData>();
	for (const trip of relevantTrips) {
		if (!uniqueTripsMap.has(trip.trip_id)) {
			uniqueTripsMap.set(trip.trip_id, trip);
		}
	}

	// Handle extended GTFS day format in sorting (hours can go beyond 24)
	const sortedTrips = [...uniqueTripsMap.values()]
		.sort((a, b) => {
			const [aHoursStr, aMinutesStr] = a.departure_time.split(":");
			const [bHoursStr, bMinutesStr] = b.departure_time.split(":");
			const aHours = Number.parseInt(aHoursStr, 10);
			const bHours = Number.parseInt(bHoursStr, 10);
			const aMinutes = Number.parseInt(aMinutesStr, 10);
			const bMinutes = Number.parseInt(bMinutesStr, 10);

			const aTotalMinutes = aHours * 60 + aMinutes;
			const bTotalMinutes = bHours * 60 + bMinutes;

			const currentTotalMinutes = currentHours * 60 + currentMinutes;

			let aMinutesFromNow = aTotalMinutes - currentTotalMinutes;
			let bMinutesFromNow = bTotalMinutes - currentTotalMinutes;

			if (currentHours >= 4 && aHours < 4) {
				aMinutesFromNow = 24 * 60 + aTotalMinutes - currentTotalMinutes;
			}
			if (currentHours >= 4 && bHours < 4) {
				bMinutesFromNow = 24 * 60 + bTotalMinutes - currentTotalMinutes;
			}

			if (currentHours >= 4 && aHours >= 24) {
				aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
			}
			if (currentHours >= 4 && bHours >= 24) {
				bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
			}

			if (currentHours < 4) {
				if (aHours >= 24) {
					aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
				}
				if (bHours >= 24) {
					bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
				}
			}

			if (aMinutesFromNow < 0 && bMinutesFromNow < 0) {
				// For past trips, closer to zero means more recent
				return bMinutesFromNow - aMinutesFromNow;
			}

			// If one is past and one is future, future trips come first
			if (aMinutesFromNow < 0 && bMinutesFromNow >= 0) {
				return 1;
			}
			if (aMinutesFromNow >= 0 && bMinutesFromNow < 0) {
				return -1;
			}

			return aMinutesFromNow - bMinutesFromNow;
		})
		.filter((trip) => {
			const [hoursStr, minutesStr] = trip.departure_time.split(":");
			const hours = Number(hoursStr);
			const minutes = Number(minutesStr);

			const tripHours = hours;
			let currentHoursForCompare = currentHours;

			const isAfterMidnight = currentHours >= 0 && currentHours < 4;
			if (isAfterMidnight && hours >= 24) {
				currentHoursForCompare += 24;
			}

			const tripTimeInMinutes = tripHours * 60 + minutes;
			const currentTimeInMinutesForCompare =
				currentHoursForCompare * 60 + currentMinutes;
			const diffInMinutes = tripTimeInMinutes - currentTimeInMinutesForCompare;

			return diffInMinutes < 0 || diffInMinutes <= 6 * 60;
		});

	const isAfterMidnight = currentHours >= 0 && currentHours < 4;
	const filteredSortedTrips = isAfterMidnight
		? sortedTrips.filter((trip) => {
				const [hoursStr, minutesStr] = trip.departure_time.split(":");
				const hours = Number(hoursStr);
				const minutes = Number(minutesStr);

				if (hours < 24 && hours < currentHours) {
					return activeVehiclePositions.has(trip.trip_id);
				}

				if (hours < 24 && hours === currentHours && minutes < currentMinutes) {
					const tripUpdate = filteredTripUpdates.find(
						(t) => t.trip.tripId === trip.trip_id,
					);

					if (tripUpdate) {
						const stopUpdate = tripUpdate.stopTimeUpdate?.find(
							(update) => update.stopId === userPosition?.closestStop?.stop_id,
						);

						if (stopUpdate?.departure?.time) {
							return Number(stopUpdate.departure.time) > currentTimeSeconds;
						}
					}

					return activeVehiclePositions.has(trip.trip_id);
				}

				if (hours >= 24) {
					const extendedCurrentHours = currentHours + 24;
					const extendedCurrentMinutes =
						extendedCurrentHours * 60 + currentMinutes;
					const tripMinutes = hours * 60 + Number(minutesStr);

					if (tripMinutes < extendedCurrentMinutes) {
						const hasRealtime = activeVehiclePositions.has(trip.trip_id);

						if (!hasRealtime) {
							const tripUpdate = filteredTripUpdates.find(
								(t) => t.trip.tripId === trip.trip_id,
							);
							if (!tripUpdate) return false;

							const stopUpdate = tripUpdate.stopTimeUpdate?.find(
								(update) =>
									update.stopId === userPosition?.closestStop?.stop_id,
							);

							return stopUpdate?.departure?.time
								? Number(stopUpdate.departure.time) > currentTimeSeconds
								: false;
						}

						return hasRealtime;
					}
				}

				return true;
			})
		: sortedTrips;

	let nextBus: IDbData | undefined;
	let rest: IDbData[] = [];

	if (filteredSortedTrips.length > 0) {
		[nextBus, ...rest] = filteredSortedTrips;
	} else if (allTripsAtUserStop.length > 0) {
		const fallbackTrips = [...allTripsAtUserStop]
			.sort((a, b) => {
				const [aHoursStr, aMinutesStr] = a.departure_time.split(":");
				const [bHoursStr, bMinutesStr] = b.departure_time.split(":");
				const aHours = Number.parseInt(aHoursStr, 10);
				const bHours = Number.parseInt(bHoursStr, 10);
				const aMinutes = Number.parseInt(aMinutesStr, 10);
				const bMinutes = Number.parseInt(bMinutesStr, 10);

				const aTotalMinutes = aHours * 60 + aMinutes;
				const bTotalMinutes = bHours * 60 + bMinutes;

				const currentTotalMinutes = currentHours * 60 + currentMinutes;

				let aMinutesFromNow = aTotalMinutes - currentTotalMinutes;
				let bMinutesFromNow = bTotalMinutes - currentTotalMinutes;

				if (currentHours >= 4 && aHours < 4) {
					aMinutesFromNow = 24 * 60 + aTotalMinutes - currentTotalMinutes;
				}
				if (currentHours >= 4 && bHours < 4) {
					bMinutesFromNow = 24 * 60 + bTotalMinutes - currentTotalMinutes;
				}

				if (currentHours >= 4 && aHours >= 24) {
					aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
				}
				if (currentHours >= 4 && bHours >= 24) {
					bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
				}

				if (currentHours < 4) {
					if (aHours >= 24) {
						aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
					}
					if (bHours >= 24) {
						bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
					}
				}

				if (aMinutesFromNow < 0 && bMinutesFromNow < 0) {
					return bMinutesFromNow - aMinutesFromNow;
				}
				if (aMinutesFromNow < 0 && bMinutesFromNow >= 0) {
					return 1;
				}
				if (aMinutesFromNow >= 0 && bMinutesFromNow < 0) {
					return -1;
				}
				return aMinutesFromNow - bMinutesFromNow;
			})
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

	calculationsCompleteRef.current = true;

	const hasTripsToDisplay = nextBus !== undefined;

	useEffect(() => {
		if (
			hasTripsToDisplay &&
			containerRef.current &&
			filteredVehicles.data.length > 0
		) {
			setTimeout(() => checkOverflow(), 50);
		}
	}, [
		hasTripsToDisplay,
		checkOverflow,
		containerRef.current,
		filteredVehicles.data.length,
	]);

	return (
		<div className="current-trips">
			<div
				className={`table-container ${isOverflowing ? "--overflowing" : ""} ${isScrolledToBottom ? "--at-bottom" : ""}`}
				aria-live="polite"
				ref={containerRef}
			>
				<div className="trips-header">
					<h1 className="text-left text-2xl font-extrabold tracking-tight text-balance">
						Avgångar närmast dig
					</h1>
					<p>
						<span className="text-muted-foreground dark">Linje: </span>
						<span className="font-bold">
							{tripData.currentTrips[0]?.route_short_name}
						</span>
					</p>
					{userPosition && (
						<p className="station-name">
							<span className="text-muted-foreground dark">
								Din närmaste hållplats:{" "}
							</span>
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
							<p className="text-sm text-zinc-300/80 !mb-2 flex items-center gap-2">
								<span
									className={`${activeVehiclePositions.has(nextBus?.trip_id) ? "w-2 h-2 rounded-full bg-accent" : "w-2 h-2 rounded-full bg-destructive"}`}
								/>{" "}
								<span className="">
									{activeVehiclePositions.has(nextBus?.trip_id)
										? "Bussen är i trafik"
										: "Bussen är inte i trafik än"}
								</span>
							</p>
							<p className="!text-xs uppercase text-zinc-300/80 tracking-wide">
								Nästa avgång:
							</p>
							<p className="time text-lg font-semibold">
								<Icon
									path={arrow.pathD}
									title="Mot"
									iconSize="24px"
									fill="whitesmoke"
									className="arrow"
								/>{" "}
								{nextBus?.stop_headsign} –{" "}
								{hasUpdate && (
									<span className="font-bold">{nextBusUpdatedTime} </span>
								)}
								<span className={hasUpdate ? "updated-time" : "scheduled-time"}>
									{nextBusScheduledTime}
								</span>{" "}
							</p>
						</div>
						<table>
							<tbody>
								<tr key="th-row">
									<th />
									<th>Mot</th>
									<th>Avgår</th>
								</tr>
								{rest.map((trip, i) => {
									const updatedTime = getUpdatedDepartureTime(trip?.trip_id);
									const scheduledTime = normalizeTimeForDisplay(
										trip?.departure_time?.slice(0, 5),
									);
									const hasUpdate =
										updatedTime && updatedTime !== scheduledTime;
									const isActive = activeVehiclePositions.has(trip.trip_id);

									return (
										<tr
											// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
											key={trip?.trip_id + i}
											onClick={() => onTripSelect?.(trip.trip_id)}
											className={`trip-row  ${isActive ? " --active" : ""}`}
											onKeyDown={(e) => {
												if (e.key === "Enter" && onTripSelect) {
													onTripSelect(trip.trip_id);
												}
											}}
										>
											<td className="">
												<span
													className={`inline-block w-2 h-2 -translate-y-[1.5px] !mr-1 rounded-full ${isActive ? "bg-accent" : "bg-destructive"}`}
												/>
											</td>
											<td key={trip.trip_id} className="align-middle">
												{trip?.stop_headsign}{" "}
												{isActive && (
													<span className="inline-block -translate-y-[1px] translate-x-[6px] absolute">
														<MapPinned className="w-6 h-6" />
													</span>
												)}
											</td>
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
