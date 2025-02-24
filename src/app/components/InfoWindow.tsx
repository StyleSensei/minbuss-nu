"use client";

import { useDataContext } from "../context/DataContext";
import { useOverflow } from "../hooks/useOverflow";
import type { IDbData } from "../models/IDbData";

interface IInfoWindowProps {
	closestStopState: IDbData | null;
}

export const InfoWindow = ({ closestStopState }: IInfoWindowProps) => {
	const { containerRef, isOverflowing } = useOverflow();
	const { filteredTripUpdates } = useDataContext();
	const closestStopTimesStamp = filteredTripUpdates
		.find((t) => t.trip.tripId === closestStopState?.trip_id)
		?.stopTimeUpdate.find((s) => s.stopId === closestStopState?.stop_id)
		?.arrival?.time;
	const scheduledTime = closestStopState?.arrival_time?.slice(0, 5);
	const closestStopArrival = closestStopTimesStamp
		? new Date(+closestStopTimesStamp * 1000).toLocaleTimeString().slice(0, 5)
		: null;
	const hasUpdate = closestStopArrival !== scheduledTime;

	return (
		<div
			className={`info-window ${isOverflowing ? "--overflowing" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			<h2>
				<span className="bus-line">{closestStopState?.route_short_name}, </span>
				<span id="final-station">{closestStopState?.stop_headsign}</span>
			</h2>
			<h2 className="next-stop">Nästa stopp: </h2>
			<p className="next-stop">{closestStopState?.stop_name}</p>
			<h2>Ankomst:</h2>
			<p>
				{closestStopState?.arrival_time.slice(0, 5) && (
					<span>{scheduledTime}</span>
				)}
				{hasUpdate && (
					<span className="updated-time"> {closestStopArrival}</span>
				)}
			</p>
		</div>
	);
};
