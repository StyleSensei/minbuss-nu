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
				// If the trip is in the future today (like "01:30" when it's currently 1:15 AM)
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
			// This is yesterday's trip in extended format (e.g., "25:30" means 1:30 AM today)
			// Add 24 hours to current time for proper comparison with extended times
			gtfsCurrentHours += 24;
			gtfsCurrentTimeInMinutes += 24 * 60;
		}
		// Not after midnight but trip is in extended format - this should not happen
		// in normal operation but handle it just in case
		else if (hours >= 24) {
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

		// Log detailed debugging info for trips near the current time in dev mode
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

		// Trip is in the past or right now
		if (timeDifferenceInMinutes <= 0) {
			// After midnight, we need to be extremely strict with past trips to avoid
			// showing yesterday's departed trips
			if (isAfterMidnight && hours < 24 && timeDifferenceInMinutes < -5) {
				// For standard-format times after midnight that are more than 5 minutes in the past,
				// only show if we have realtime tracking
				return activeVehiclePositions.has(tripId);
			}

			// Check if we have realtime data that would make this trip still relevant
			const tripUpdate = filteredTripUpdates.find(
				(t) => t.trip.tripId === tripId,
			);

			if (!tripUpdate) {
				// Only show trips that departed extremely recently (within 1 minute)
				// This helps avoid showing trips that departed just before midnight
				return timeDifferenceInMinutes >= -1;
			}

			const stopUpdate = tripUpdate.stopTimeUpdate?.find(
				(update) => update.stopId === userPosition?.closestStop?.stop_id,
			);

			if (stopUpdate?.departure?.time) {
				// Show trip only if realtime data indicates it hasn't departed yet
				return Number(stopUpdate.departure.time) > currentTimeSeconds;
			}

			return false;
		}

		// For trips with scheduled times in the past but more than 15 minutes ago,
		// only show them if they have realtime tracking (still on the road)
		if (timeDifferenceInMinutes < -15) {
			return activeVehiclePositions.has(tripId);
		}

		// Future trips within 6 hours should be shown
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

	// First process and filter trips
	const relevantTrips = allTripsAtUserStop
		.filter(isTripRelevant)
		.sort((a, b) => {
			// We'll sort by realtime tracking first
			const aHasRealtime = activeVehiclePositions.has(a.trip_id);
			const bHasRealtime = activeVehiclePositions.has(b.trip_id);

			if (aHasRealtime && !bHasRealtime) return -1;
			if (!aHasRealtime && bHasRealtime) return 1;

			// Then we'll compare departure times - this can be removed since we do proper sorting below
			return 0; // We'll rely on the sortedTrips step for proper time comparison
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

			// Compute relative time compared to current time
			// This ensures we sort by "how soon" rather than by absolute time

			// Calculate total minutes for each trip
			const aTotalMinutes = aHours * 60 + aMinutes;
			const bTotalMinutes = bHours * 60 + bMinutes;

			// Calculate minutes since midnight for current time
			const currentTotalMinutes = currentHours * 60 + currentMinutes;

			// Calculate how many minutes from now until each trip
			let aMinutesFromNow = aTotalMinutes - currentTotalMinutes;
			let bMinutesFromNow = bTotalMinutes - currentTotalMinutes;

			// For early morning trips when not after midnight, they are tomorrow
			if (currentHours >= 4 && aHours < 4) {
				aMinutesFromNow = 24 * 60 + aTotalMinutes - currentTotalMinutes;
			}
			if (currentHours >= 4 && bHours < 4) {
				bMinutesFromNow = 24 * 60 + bTotalMinutes - currentTotalMinutes;
			}

			// For extended format (24+), adjust if we're not after midnight
			if (currentHours >= 4 && aHours >= 24) {
				aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
			}
			if (currentHours >= 4 && bHours >= 24) {
				bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
			}

			// Handle after midnight case specifically (0-4 AM)
			if (currentHours < 4) {
				// After midnight, handle extended format trips
				if (aHours >= 24) {
					// These are last night's trips with 24+ format, adjust the calculation
					aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
				}
				if (bHours >= 24) {
					bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
				}

				// Early morning trips (0-4) are today
				// No adjustment needed as they're already correctly calculated
			}

			// Negative values mean the trip is in the past
			// Handle past trips by comparing how recently they departed
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

			// Both are future trips, sort by closest first
			return aMinutesFromNow - bMinutesFromNow;
		})
		// Extra check to ensure we only show trips within the next 4 hours
		.filter((trip) => {
			const [hoursStr, minutesStr] = trip.departure_time.split(":");
			const hours = Number(hoursStr);
			const minutes = Number(minutesStr);

			// Convert trip time to comparable format with current time
			const tripHours = hours;
			let currentHoursForCompare = currentHours;

			// Handle extended format when after midnight
			const isAfterMidnight = currentHours >= 0 && currentHours < 4;
			if (isAfterMidnight && hours >= 24) {
				currentHoursForCompare += 24;
			}

			// Calculate time difference in minutes
			const tripTimeInMinutes = tripHours * 60 + minutes;
			const currentTimeInMinutesForCompare =
				currentHoursForCompare * 60 + currentMinutes;
			const diffInMinutes = tripTimeInMinutes - currentTimeInMinutesForCompare;

			// Log for debugging
			if (process.env.NODE_ENV === "development") {
				console.log(
					`Trip time filter: ${trip.departure_time}, diff: ${diffInMinutes} mins`,
				);
			}

			// For past trips, rely on isTripRelevant which has more complex logic
			// For future trips, only include those within the next 6 hours
			return diffInMinutes < 0 || diffInMinutes <= 6 * 60;
		});

	// Do an extra check for trips that might have departed just before midnight
	// but still show up in the data
	const isAfterMidnight = currentHours >= 0 && currentHours < 4;
	const filteredSortedTrips = isAfterMidnight
		? sortedTrips.filter((trip) => {
				// For trips after midnight, we need to be more strict
				const [hoursStr, minutesStr] = trip.departure_time.split(":");
				const hours = Number(hoursStr);
				const minutes = Number(minutesStr);

				// For regular time format trips (0-23 hours) that are in the past
				if (hours < 24 && hours < currentHours) {
					// Only keep if we have realtime tracking data
					return activeVehiclePositions.has(trip.trip_id);
				}

				// For regular time format that's in the current hour
				if (hours < 24 && hours === currentHours && minutes < currentMinutes) {
					// For trips that should have departed in the current hour,
					// verify with realtime data
					const tripUpdate = filteredTripUpdates.find(
						(t) => t.trip.tripId === trip.trip_id,
					);

					if (tripUpdate) {
						const stopUpdate = tripUpdate.stopTimeUpdate?.find(
							(update) => update.stopId === userPosition?.closestStop?.stop_id,
						);

						if (stopUpdate?.departure?.time) {
							// Only show if realtime data indicates it hasn't departed yet
							return Number(stopUpdate.departure.time) > currentTimeSeconds;
						}
					}

					// Without realtime data, only keep if the bus is tracked on the map
					return activeVehiclePositions.has(trip.trip_id);
				}

				// For extended format trips (24+ hours)
				if (hours >= 24) {
					// Calculate equivalent current time in the extended format
					const extendedCurrentHours = currentHours + 24;
					const extendedCurrentMinutes =
						extendedCurrentHours * 60 + currentMinutes;
					const tripMinutes = hours * 60 + Number(minutesStr);

					// If the trip should have departed already
					if (tripMinutes < extendedCurrentMinutes) {
						// Check if we have realtime data or trip updates
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

							// Only include if realtime data shows it hasn't departed
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

	// Add debug logging
	// biome-ignore lint/correctness/useExhaustiveDependencies: This is just for logging
	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			console.log(
				`CurrentTrips - Current time: ${currentHours}:${currentMinutes.toString().padStart(2, "0")}`,
				`IsAfterMidnight: ${isAfterMidnight}`,
			);

			// Log raw data
			console.log(
				"Data from database (upcomingTrips):",
				allTripsAtUserStop.length,
			);

			// Log trips at each stage of filtering
			console.log("After isTripRelevant filter:", relevantTrips.length);
			console.log("After sorting and uniqueness:", uniqueTripsMap.size);
			console.log("After final time window filter:", sortedTrips.length);
			console.log(
				"After midnight special filtering:",
				filteredSortedTrips.length,
			);

			if (allTripsAtUserStop.length > 0) {
				console.log(
					"Sample trip time from database:",
					allTripsAtUserStop[0]?.departure_time,
				);

				// Log detailed info about the first few trips when after midnight
				if (isAfterMidnight) {
					const firstFewTrips = allTripsAtUserStop.slice(0, 5);
					console.log(
						"After midnight debug - First few trips before filtering:",
					);
					firstFewTrips.forEach((trip, i) => {
						const [hours, minutes] = trip.departure_time.split(":");
						const hasRealtime = activeVehiclePositions.has(trip.trip_id);
						console.log(
							`Trip #${i}: ${hours}:${minutes}, realtime tracking: ${hasRealtime}, id: ${trip.trip_id.slice(-6)}`,
						);
					});

					// Log info about relevant trips after first filter
					if (relevantTrips.length > 0) {
						console.log(
							"After first filter:",
							relevantTrips.length,
							"trips remain",
						);
						relevantTrips.slice(0, 3).forEach((trip, i) => {
							console.log(
								`Relevant trip #${i}: ${trip.departure_time}, id: ${trip.trip_id.slice(-6)}`,
							);
						});
					}

					// Log info about final filtered trips
					if (filteredSortedTrips && filteredSortedTrips.length > 0) {
						console.log(
							"Final trips after all filtering:",
							filteredSortedTrips.length,
						);
						console.log(
							"First trip after filtering:",
							filteredSortedTrips[0].departure_time,
						);
					} else {
						console.log("No trips left after filtering");
					}
				} else {
					// Log a sample of trips at each filtering stage
					if (relevantTrips.length > 0) {
						console.log("Sample relevant trips:");
						relevantTrips.slice(0, 3).forEach((trip, i) => {
							console.log(`Trip #${i}: ${trip.departure_time}`);
						});
					}

					if (sortedTrips.length > 0) {
						console.log("Sample sorted trips:");
						sortedTrips.slice(0, 5).forEach((trip, i) => {
							const [hours, minutes] = trip.departure_time.split(":");
							const hourNum = Number(hours);
							const minNum = Number(minutes);
							const totalMins = hourNum * 60 + minNum;
							const currentTotalMins = currentHours * 60 + currentMinutes;
							let minutesFromNow = totalMins - currentTotalMins;

							// Adjust for midnight boundary
							if (currentHours >= 4 && hourNum < 4) {
								minutesFromNow = 24 * 60 + totalMins - currentTotalMins;
							}
							if (currentHours >= 4 && hourNum >= 24) {
								minutesFromNow = totalMins - (currentTotalMins + 24 * 60);
							}
							if (currentHours < 4 && hourNum >= 24) {
								minutesFromNow = totalMins - (currentTotalMins + 24 * 60);
							}

							console.log(
								`Trip #${i}: ${trip.departure_time} (${hours}h:${minutes}m), minutes from now: ${minutesFromNow}, id: ${trip.trip_id.slice(-6)}`,
							);
						});

						// Log the actual order after all filtering
						if (filteredSortedTrips.length > 0) {
							console.log("Final order after all filtering:");
							filteredSortedTrips.slice(0, 5).forEach((trip, i) => {
								const [hours, minutes] = trip.departure_time.split(":");
								const hourNum = Number(hours);
								const minNum = Number(minutes);
								const totalMins = hourNum * 60 + minNum;
								const currentTotalMins = currentHours * 60 + currentMinutes;
								let minutesFromNow = totalMins - currentTotalMins;

								// Adjust for midnight boundary
								if (currentHours >= 4 && hourNum < 4) {
									minutesFromNow = 24 * 60 + totalMins - currentTotalMins;
								}
								if (currentHours >= 4 && hourNum >= 24) {
									minutesFromNow = totalMins - (currentTotalMins + 24 * 60);
								}
								if (currentHours < 4 && hourNum >= 24) {
									minutesFromNow = totalMins - (currentTotalMins + 24 * 60);
								}

								console.log(
									`Trip #${i}: ${trip.departure_time} (${hours}h:${minutes}m), minutes from now: ${minutesFromNow}, id: ${trip.trip_id.slice(-6)}`,
								);
							});
						}
					}

					if (filteredSortedTrips.length === 0) {
						console.log("WARNING: All trips were filtered out!");
					}
				}
			} else {
				console.log("No trips found at user stop");
			}
		}
	}, [
		allTripsAtUserStop.length,
		currentHours,
		currentMinutes,
		activeVehiclePositions,
		relevantTrips,
		sortedTrips,
		filteredSortedTrips,
		isAfterMidnight,
		uniqueTripsMap.size,
	]);

	let nextBus: IDbData | undefined;
	let rest: IDbData[] = [];

	if (filteredSortedTrips.length > 0) {
		[nextBus, ...rest] = filteredSortedTrips;
	} else if (allTripsAtUserStop.length > 0) {
		// If filtering removed all trips, use a more robust fallback sorting
		const fallbackTrips = [...allTripsAtUserStop]
			.sort((a, b) => {
				// Use the same sorting logic as sortedTrips for consistency
				const [aHoursStr, aMinutesStr] = a.departure_time.split(":");
				const [bHoursStr, bMinutesStr] = b.departure_time.split(":");
				const aHours = Number.parseInt(aHoursStr, 10);
				const bHours = Number.parseInt(bHoursStr, 10);
				const aMinutes = Number.parseInt(aMinutesStr, 10);
				const bMinutes = Number.parseInt(bMinutesStr, 10);

				// Calculate total minutes for each trip
				const aTotalMinutes = aHours * 60 + aMinutes;
				const bTotalMinutes = bHours * 60 + bMinutes;

				// Calculate minutes since midnight for current time
				const currentTotalMinutes = currentHours * 60 + currentMinutes;

				// Calculate how many minutes from now until each trip
				let aMinutesFromNow = aTotalMinutes - currentTotalMinutes;
				let bMinutesFromNow = bTotalMinutes - currentTotalMinutes;

				// For early morning trips when not after midnight, they are tomorrow
				if (currentHours >= 4 && aHours < 4) {
					aMinutesFromNow = 24 * 60 + aTotalMinutes - currentTotalMinutes;
				}
				if (currentHours >= 4 && bHours < 4) {
					bMinutesFromNow = 24 * 60 + bTotalMinutes - currentTotalMinutes;
				}

				// For extended format (24+), adjust if we're not after midnight
				if (currentHours >= 4 && aHours >= 24) {
					aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
				}
				if (currentHours >= 4 && bHours >= 24) {
					bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
				}

				// Handle after midnight case specifically (0-4 AM)
				if (currentHours < 4) {
					// After midnight, handle extended format trips
					if (aHours >= 24) {
						aMinutesFromNow = aTotalMinutes - (currentTotalMinutes + 24 * 60);
					}
					if (bHours >= 24) {
						bMinutesFromNow = bTotalMinutes - (currentTotalMinutes + 24 * 60);
					}
				}

				// Sort based on minutes from now
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
