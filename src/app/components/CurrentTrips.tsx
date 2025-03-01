import type { IDbData } from "../models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import useUserPosition from "../hooks/useUserPosition";
import { useDataContext } from "../context/DataContext";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { Icon } from "./Icon";
import { arrow, earth } from "../../../public/icons";

interface ICurrentTripsProps {
	lastStops: IDbData[];
	onTripSelect?: (tripId: string) => void;
}

export const CurrentTrips = ({
	lastStops,
	onTripSelect,
}: ICurrentTripsProps) => {
	const { containerRef, isOverflowing } = useOverflow();
	const { filteredVehicles, cachedDbDataState, filteredTripUpdates } =
		useDataContext();

	const { userPosition } = useUserPosition();

	if (!userPosition?.closestStop) return null;
	const userStopSeqs = cachedDbDataState
		.filter((stop) => stop.stop_name === userPosition?.closestStop?.stop_name)
		.map((stop) => stop.stop_sequence);

	const notPassedBuses = filteredVehicles.filter((bus) => {
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

	const [nextBus, ...rest] = notPassedStops;
	const nextBusUpdatedTime = getUpdatedArrivalTime(nextBus?.trip_id);
	const nextBusScheduledTime = nextBus?.arrival_time?.slice(0, 5);
	const hasUpdate =
		nextBusUpdatedTime && nextBusUpdatedTime !== nextBusScheduledTime;

	return (
		<div
			className={`table-container ${isOverflowing ? "--overflowing" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			{" "}
			<div className="trips-header">
				<h2>Linje: {lastStops[0].route_short_name}</h2>
				{userPosition && (
					<p className="station-name">
						Din närmaste hållplats:{" "}
						<strong>{userPosition?.closestStop?.stop_name}</strong>
					</p>
				)}
			</div>
			{notPassedStops?.length > 0 && (
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
								iconSize="1rem"
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
							{rest.map((trip) => {
								const updatedTime = getUpdatedArrivalTime(trip?.trip_id);
								const scheduledTime = trip?.arrival_time?.slice(0, 5);
								const hasUpdate = updatedTime && updatedTime !== scheduledTime;

								return (
									<tr
										key={trip?.trip_id}
										onClick={() => onTripSelect?.(trip.trip_id)}
										className="trip-row"
										onKeyDown={(e) => {
											if (e.key === "Enter" && onTripSelect) {
												onTripSelect(trip.trip_id);
											}
										}}
									>
										<td>{trip?.stop_headsign}</td>
										<td>
											{hasUpdate && <span>{updatedTime}</span>}
											<span className={hasUpdate ? "updated-time" : ""}>
												{" "}
												{scheduledTime}{" "}
												<Icon
													path={earth.pathD}
													title="Visa på karta"
													iconSize="1rem"
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
