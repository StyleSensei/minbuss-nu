"use client";

import { useEffect, useState } from "react";
import { useDataContext } from "../context/DataContext";
import { useOverflow } from "../hooks/useOverflow";
import type { IDbData } from "../models/IDbData";

interface IInfoWindowProps {
	closestStopState: IDbData | null;
	tripId?: string;
}

export const InfoWindow = ({ closestStopState, tripId }: IInfoWindowProps) => {
	const { containerRef, isOverflowing } = useOverflow();
	const { filteredTripUpdates, cachedDbDataState } = useDataContext();
	const [localClosestStop, setLocalClosestStop] = useState<IDbData | null>(
		null,
	);
	useEffect(() => {
		if (!closestStopState && tripId) {
			const tripStops = cachedDbDataState
				.filter((stop) => stop.trip_id === tripId)
				.sort((a, b) => a.stop_sequence - b.stop_sequence);

			if (tripStops.length > 0) {
				setLocalClosestStop(tripStops[0]);
			}
		}
	}, [closestStopState, tripId, cachedDbDataState]);

	const effectiveStop = closestStopState || localClosestStop;

	const closestStopTimesStamp = filteredTripUpdates
		.find((t) => t.trip.tripId === effectiveStop?.trip_id)
		?.stopTimeUpdate.find((s) => s.stopId === effectiveStop?.stop_id)
		?.arrival?.time;
	const scheduledTime = effectiveStop?.arrival_time?.slice(0, 5);
	const closestStopArrival = closestStopTimesStamp
		? new Date(+closestStopTimesStamp * 1000).toLocaleTimeString().slice(0, 5)
		: null;
	const hasUpdate = closestStopArrival && closestStopArrival !== scheduledTime;
	return (
		<div
			className={`info-window ${isOverflowing ? "--overflowing" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			<h2>
				<span className="bus-line">{effectiveStop?.route_short_name}, </span>
				<span id="final-station">{effectiveStop?.stop_headsign}</span>
			</h2>
			<h2 className="next-stop">Nästa stopp: </h2>
			<p className="next-stop">{effectiveStop?.stop_name}</p>
			<h2>Ankomst:</h2>
			<p>
				{hasUpdate && <span>{closestStopArrival}</span>}
				<span className={hasUpdate ? "updated-time" : ""}>
					{" "}
					{scheduledTime}
				</span>
			</p>
		</div>
	);
};
