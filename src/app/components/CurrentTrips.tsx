import type { IDbData } from "@shared/models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import { useDataContext } from "../context/DataContext";
import { Icon } from "./Icon";
import { arrow } from "../../../public/icons";
import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { convertGTFSTimeToDate } from "../utilities/convertGTFSTimeToDate";
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
	const [, setDataReady] = useState(false);

	const [tripsToDisplay, setTripsToDisplay] = useState<IDbData[]>([]);

	const activeVehiclePositions = new Map();
	for (const bus of filteredVehicles.data) {
		activeVehiclePositions.set(bus.trip.tripId, {
			lat: bus.position.latitude,
			lon: bus.position.longitude,
			tripId: bus.trip.tripId,
		});
	}

	useEffect(() => {
		if (
			(filteredVehicles.data.length > 0 || tripData.upcomingTrips.length > 0) &&
			userPosition?.closestStop
		) {
			setDataReady(true);
			setShowLoadingTrips(false);
		}
	}, [
		filteredVehicles.data.length,
		userPosition?.closestStop,
		tripData.upcomingTrips.length,
		setShowLoadingTrips,
	]);
	useEffect(() => {
		if (userPosition?.closestStop) {
			setTripsToDisplay(
				tripData.upcomingTrips.filter((trip) => {
					if (trip.stop_name !== userPosition.closestStop?.stop_name) {
						return false;
					}

					try {
						const updatedTimeStr = getUpdatedDepartureTime(trip.trip_id);
						const departureTime = updatedTimeStr
							? convertGTFSTimeToDate(updatedTimeStr)
							: convertGTFSTimeToDate(trip.departure_time);

						const minutesSinceScheduledDeparture =
							(Date.now() - departureTime.getTime()) / (1000 * 60);

						if (minutesSinceScheduledDeparture > 0) {
							return false;
						}

						return true;
					} catch (error) {
						console.error(`Error checking trip ${trip.trip_id}:`, error);
						return true;
					}
				}),
			);
		} else {
			setTripsToDisplay(tripData.upcomingTrips);
		}
	}, [userPosition?.closestStop, tripData.upcomingTrips]);

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

	let nextBus: IDbData | undefined;
	let rest: IDbData[] = [];

	if (tripsToDisplay.length > 0) {
		[nextBus, ...rest] = tripsToDisplay;
	}

	const nextBusUpdatedTime = nextBus
		? getUpdatedDepartureTime(nextBus.trip_id)
		: undefined;

	const nextBusScheduledTime = nextBus?.departure_time
		? normalizeTimeForDisplay(nextBus.departure_time.slice(0, 5))
		: undefined;

	const hasUpdate =
		nextBusUpdatedTime && nextBusUpdatedTime !== nextBusScheduledTime;

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
		containerRef,
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
						{rest.length > 0 ? (
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
						) : (
							<p>Inga kommande avgångar inom 6 timmar</p>
						)}
					</>
				) : (
					<p>Inga kommande avgångar att visa.</p>
				)}
			</div>
		</div>
	);
};
