import type { IDbData } from "@shared/models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import useUserPosition from "../hooks/useUserPosition";
import { useDataContext } from "../context/DataContext";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { Icon } from "./Icon";
import { arrow, earth } from "../../../public/icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface ICurrentTripsProps {
	onTripSelect?: (tripId: string) => void;
	setShowLoadingTrips: (value: boolean) => void;
}

export const CurrentTrips = ({
	onTripSelect,
	setShowLoadingTrips,
}: ICurrentTripsProps) => {
	const { containerRef, isOverflowing } = useOverflow();
	const { filteredVehicles, cachedDbDataState, filteredTripUpdates } =
		useDataContext();

	const { userPosition } = useUserPosition();
	const [dataReady, setDataReady] = useState(false);
	const calculationsCompleteRef = useRef(false);
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

	if (!userPosition?.closestStop) return null;

	const userStopSeqs = cachedDbDataState
		.filter((stop) => stop.stop_name === userPosition?.closestStop?.stop_name)
		.map((stop) => stop.stop_sequence);

	const notPassedBuses = filteredVehicles.data.filter((bus) => {
		const busStops = cachedDbDataState.filter(
			(s) => s.trip_id === bus.trip.tripId,
		);
		const sortedStops = busStops.sort(
			(a, b) => a.stop_sequence - b.stop_sequence,
		);
		const currentBusStop = sortedStops.reduce(
			(closest, stop) => {
				const distance = getDistanceFromLatLon(
					bus.position.latitude,
					bus.position.longitude,
					stop.stop_lat,
					stop.stop_lon,
				);
				if (!closest || distance < closest.distance) {
					return { stop, distance };
				}
				return closest;
			},
			null as { stop: IDbData; distance: number } | null,
		);

		if (!currentBusStop || currentBusStop.distance > 10000) {
			return false;
		}

		return userStopSeqs.some((seq) => currentBusStop.stop.stop_sequence <= seq);
	});

	const userStops = cachedDbDataState.filter(
		(stop) => stop.stop_name === userPosition?.closestStop?.stop_name,
	);

	const notPassedStops = userPosition?.tripsAtClosestStop
		.filter((trip) => {
			const matchingBus = notPassedBuses.find(
				(bus) => trip.trip_id === bus.trip.tripId,
			);

			if (!matchingBus) return false;

			const busCurrentStop = cachedDbDataState
				.filter((s) => s.trip_id === matchingBus.trip.tripId)
				.sort((a, b) => a.stop_sequence - b.stop_sequence)
				.reduce(
					(closest, stop) => {
						const distance = getDistanceFromLatLon(
							matchingBus.position.latitude,
							matchingBus.position.longitude,
							stop.stop_lat,
							stop.stop_lon,
						);
						if (!closest || distance < closest.distance) {
							return { stop, distance };
						}
						return closest;
					},
					null as { stop: IDbData; distance: number } | null,
				);

			if (!busCurrentStop) return false;

			return userStops.some(
				(stop) =>
					stop.trip_id === trip.trip_id &&
					stop.stop_sequence > busCurrentStop.stop.stop_sequence,
			);
		})
		.sort((a, b) => {
			if (
				(a.arrival_time.startsWith("23") && b.arrival_time.startsWith("00")) ||
				(a.arrival_time.startsWith("00") && b.arrival_time.startsWith("23"))
			) {
				return +b.arrival_time.slice(0, 2) - +a.arrival_time.slice(0, 2);
			}
			return a.arrival_time.localeCompare(b.arrival_time);
		});

	const notPassedStopsMap = new Map<string, IDbData>();
	for (const stop of notPassedStops) {
		notPassedStopsMap.set(stop.trip_id, stop);
	}

	const filteredStops = Array.from(notPassedStopsMap.values());

	function getUpdatedArrivalTime(tripId: string) {
		if (!filteredTripUpdates.length || !notPassedStops?.length) return;
		const updatedTrip = filteredTripUpdates.find(
			(t) => t.trip.tripId === tripId,
		);
		const updatedStop = updatedTrip?.stopTimeUpdate?.find((stop) =>
			notPassedStops.some((s) => stop.stopId === s.stop_id),
		);
		const arrivalTimeStamp = updatedStop?.arrival?.time;
		if (!arrivalTimeStamp) return;
		const arrivalTime = new Date(+arrivalTimeStamp * 1000).toLocaleTimeString();
		return arrivalTime.slice(0, 5);
	}

	const [nextBus, ...rest] = filteredStops;
	const nextBusUpdatedTime = getUpdatedArrivalTime(nextBus?.trip_id);
	const nextBusScheduledTime = nextBus?.arrival_time?.slice(0, 5);
	const hasUpdate =
		nextBusUpdatedTime && nextBusUpdatedTime !== nextBusScheduledTime;

	calculationsCompleteRef.current = !!notPassedStops;
	return (
		<div
			className={`table-container ${isOverflowing ? "--overflowing" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			{" "}
			<div className="trips-header">
				<h2>Linje: {cachedDbDataState[0].route_short_name}</h2>
				{userPosition && (
					<p className="station-name">
						Din närmaste hållplats:{" "}
						<strong>{userPosition?.closestStop?.stop_name}</strong>
					</p>
				)}
			</div>
			{filteredStops?.length > 0 && (
				<>
					<div
						className="next-departure"
						onClick={() => onTripSelect?.(nextBus.trip_id)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && onTripSelect) {
								onTripSelect(nextBus.trip_id);
							}
						}}
					>
						<p>🕒 Nästa avgång:</p>
						<p className="time">
							<Icon
								path={arrow.pathD}
								title="Mot"
								iconSize="24px"
								fill="black"
								className="arrow"
							/>{" "}
							{nextBus.stop_headsign} –{" "}
							{hasUpdate && <span>{nextBusUpdatedTime} </span>}
							<span className={hasUpdate ? "updated-time" : "scheduled-time"}>
								{nextBusScheduledTime}
							</span>{" "}
							<Icon
								path={earth.pathD}
								title="Visa på karta"
								iconSize="16px"
								fill="black"
								className="icon-earth--next-trip"
							/>
						</p>
					</div>
					{/*  */}
					<table>
						<caption>
							Kommande avgångar från {userPosition?.closestStop?.stop_name}:
						</caption>

						<tbody>
							{rest.map((trip, i) => {
								const updatedTime = getUpdatedArrivalTime(trip?.trip_id);
								const scheduledTime = trip?.arrival_time?.slice(0, 5);
								const hasUpdate = updatedTime && updatedTime !== scheduledTime;

								return (
									<tr
										// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
										key={trip?.trip_id + i}
										onClick={() => onTripSelect?.(trip.trip_id)}
										className="trip-row"
										onKeyDown={(e) => {
											if (e.key === "Enter" && onTripSelect) {
												onTripSelect(trip.trip_id);
											}
										}}
									>
										<td key={trip.trip_id}>{trip?.stop_headsign}</td>
										<td>
											{hasUpdate && <span>{updatedTime}</span>}
											<span className={hasUpdate ? "updated-time" : ""}>
												{" "}
												{scheduledTime}{" "}
												<Icon
													path={earth.pathD}
													title="Visa på karta"
													iconSize="16px"
													fill="white"
													className="icon-earth"
												/>
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</>
			)}
		</div>
	);
};
