import type { IDbData } from "@shared/models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import { useDataContext } from "../context/DataContext";
import { Icon } from "./Icon";
import { arrow } from "../../../public/icons";
import { useEffect, useMemo, useState } from "react";
import { MapPinned } from "lucide-react";
import { convertGTFSTimeToDate } from "../utilities/convertGTFSTimeToDate";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import { CurrentTripsLoader } from "./CurrentTripsLoader";
import { IVehiclePosition } from "@/shared/models/IVehiclePosition";

interface ICurrentTripsProps {
	onTripSelect?: (tripId: string) => void;
	mapRef?: React.MutableRefObject<google.maps.Map | null>;
	closestStop?: IDbData;
}

export const CurrentTrips = ({
	onTripSelect,
	mapRef,
	closestStop,
}: ICurrentTripsProps) => {
	const { containerRef, isOverflowing, checkOverflow, isScrolledToBottom } =
		useOverflow();
	const { filteredVehicles, tripData, filteredTripUpdates, userPosition, isLoading } =
		useDataContext();
	const [hasFilteredOnce, setHasFilteredOnce] = useState(false);

	const [tripsToDisplay, setTripsToDisplay] = useState<IDbData[]>([]);
	const closestStopToUse = closestStop ?? userPosition?.closestStop;

	const activeVehiclePositions = useMemo(
		() => new Set(filteredVehicles.data.map((bus: IVehiclePosition) => bus.trip.tripId)),
		[filteredVehicles.data],
	);

	useEffect(() => {
		filterTrips();
		setHasFilteredOnce(true);

		const intervalId = setInterval(() => {
			filterTrips();
		}, 30000);

		return () => clearInterval(intervalId);

		function filterTrips() {
			if (closestStopToUse) {
				const stopName = closestStopToUse.stop_name;
				setTripsToDisplay(
					tripData.upcomingTrips.filter((trip) => {
						if (trip.stop_name !== stopName) {
							return false;
						}

						try {
							const updatedTimeStr = getUpdatedDepartureTime(
								trip.trip_id,
								closestStopToUse,
							);
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
		}
	}, [closestStopToUse?.stop_id, tripData.upcomingTrips, filteredTripUpdates]);
	function getUpdatedDepartureTime(
		tripId: string,
		stop: IDbData | null | undefined,
	): string | undefined {
		if (!stop?.stop_id) return undefined;
		if (!filteredTripUpdates.length) return undefined;

		const tripUpdate = filteredTripUpdates.find(
			(t) => t.trip.tripId === tripId,
		);

		if (!tripUpdate) return undefined;

		const stopIdPrefix = stop.stop_id.slice(0, -3);
		const stopUpdate = tripUpdate.stopTimeUpdate?.find(
			(update) => update.stopId.slice(0, -3) === stopIdPrefix,
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
		? getUpdatedDepartureTime(nextBus.trip_id, closestStopToUse)
		: undefined;

	const nextBusScheduledTime = nextBus?.departure_time
		? normalizeTimeForDisplay(nextBus.departure_time.slice(0, 5))
		: undefined;

	const hasUpdate =
		nextBusUpdatedTime && nextBusUpdatedTime !== nextBusScheduledTime;

	const hasTripsToDisplay = nextBus !== undefined;
	const routeShortName =
		tripData.currentTrips[0]?.route_short_name ??
		tripData.upcomingTrips[0]?.route_short_name ??
		tripData.lineStops[0]?.route_short_name ??
		"";

	const isActive = nextBus
		? activeVehiclePositions.has(nextBus?.trip_id)
		: false;
	const handleOnStopClick = (stop: IDbData) => {
		if (mapRef?.current) {
			const position = new google.maps.LatLng(+stop.stop_lat, +stop.stop_lon);
			mapRef.current.panTo(position);
			mapRef.current.setZoom(18);
		}
	};

	useEffect(() => {
		if (
			hasTripsToDisplay &&
			containerRef.current &&
			filteredVehicles.data.length > 0 &&
			hasFilteredOnce &&
			!isLoading
		) {
			setTimeout(() => checkOverflow(), 50);
		}
	}, [
		hasTripsToDisplay,
		checkOverflow,
		containerRef,
		filteredVehicles.data.length,
		hasFilteredOnce,
		isLoading,
	]);

	if (!hasFilteredOnce || isLoading) {
		return <CurrentTripsLoader />;
	}

	return (
		<div className="current-trips">
			<div
				className={`table-container ${isOverflowing ? "--overflowing" : ""} ${isScrolledToBottom ? "--at-bottom" : ""}`}
				aria-live="polite"
				ref={containerRef}
				onScroll={checkOverflow}
			>
				<div className="trips-header">
					<h2 className="text-left text-2xl font-extrabold tracking-tight text-balance">
						Avgångar närmast dig
					</h2>
					<p>
						<span className="text-muted-foreground dark">Linje: </span>
						<span className="font-bold">
							{routeShortName}
						</span>
					</p>
					{closestStopToUse && (
						<p className="station-name">
							<span className="text-muted-foreground dark">
								Din närmaste hållplats:{" "}
							</span>
							<button
								type="button"
								onClick={() => {
									handleOnStopClick(closestStopToUse);
								}}
							>
								<strong>{closestStopToUse.stop_name}</strong>
							</button>
						</p>
					)}
				</div>
				{hasTripsToDisplay ? (
					<>
						<button
							type="button"
							title={isActive ? "Visa position" : "Bussen är inte i trafik"}
							aria-label={`Visa nästa buss mot ${nextBus?.stop_headsign} som avgår ${nextBusUpdatedTime || nextBusScheduledTime}`}
							className={`next-departure ${isActive ? " --active" : ""}`}
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
									className={`${isActive ? "w-2 h-2 rounded-full bg-accent" : "w-2 h-2 rounded-full bg-destructive"}`}
								/>{" "}
								<span className="">
									{isActive
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
								{isActive && (
									<span className="inline-block -translate-y-[1px] translate-x-[6px]">
										<MapPinned className="w-6 h-6" />
									</span>
								)}
							</p>
						</button>
						{rest.length > 0 ? (
							<table>
								<thead className="px-2">
									<tr key="th-row">
										<th />
										<th>Mot</th>
										<th>Avgår</th>
									</tr>
								</thead>
								<tbody>
									{rest.map((trip, i) => {
										const updatedTime = getUpdatedDepartureTime(trip?.trip_id, closestStopToUse);
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
												className={`trip-row  ${isActive ? " --active" : ""}`}
											>
												<td>
													<span
														className={`inline-block w-2 h-2 -translate-y-[1.5px] !mr-1 rounded-full ${isActive ? "bg-accent" : "bg-destructive"}`}
													/>
												</td>
												<td key={trip.trip_id} className="align-middle">
													<button
														type="button"
														className="row-button"
														title={
															isActive
																? "Visa position"
																: "Bussen är inte i trafik"
														}
														onClick={() => onTripSelect?.(trip.trip_id)}
														onKeyDown={(e) => {
															if (e.key === "Enter" && onTripSelect) {
																onTripSelect(trip.trip_id);
															}
														}}
														style={!isActive ? { cursor: "auto" } : {}}
														aria-label={`Visa buss mot ${trip?.stop_headsign} som avgår ${updatedTime || scheduledTime}`}
													>
														{trip?.stop_headsign}{" "}
														{isActive && (
															<span className="inline-block -translate-y-[1px] translate-x-[6px] absolute">
																<MapPinned className="w-6 h-6" />
															</span>
														)}
													</button>
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
							<p className="text-muted-foreground dark text-center">
								Inga fler avgångar inom 6 timmar
							</p>
						)}
					</>
				) : (
					<p className="text-muted-foreground dark text-center">Inga fler avgångar inom 6 timmar</p>
				)}
			</div>
		</div>
	);
};
