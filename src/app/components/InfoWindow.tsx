"use client";

import { useEffect, useState } from "react";
import { useDataContext } from "../context/DataContext";
import { useOverflow } from "../hooks/useOverflow";
import type { IDbData } from "@shared/models/IDbData";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";

interface IInfoWindowProps {
	closestStopState: IDbData | null;
	tripId?: string;
}

export const InfoWindow = ({ closestStopState, tripId }: IInfoWindowProps) => {
	const { containerRef, isOverflowing } = useOverflow();
	const { filteredTripUpdates, tripData } = useDataContext();
	const [localClosestStop, setLocalClosestStop] = useState<IDbData | null>(
		null,
	);
	useEffect(() => {
		if (!closestStopState && tripId) {
			const tripStops = tripData.currentTrips
				.filter((stop) => stop.trip_id === tripId)
				.sort((a, b) => a.stop_sequence - b.stop_sequence);

			if (tripStops.length > 0) {
				setLocalClosestStop(tripStops[0]);
			}
		}
	}, [closestStopState, tripId, tripData.currentTrips]);

	const effectiveStop = closestStopState || localClosestStop;

	const closestStopTimesStamp = filteredTripUpdates
		.find((t) => t.trip.tripId === effectiveStop?.trip_id)
		?.stopTimeUpdate.find((s) => s.stopId === effectiveStop?.stop_id)
		?.departure?.time;
	const scheduledTime = effectiveStop?.departure_time
		? normalizeTimeForDisplay(effectiveStop.departure_time.slice(0, 5))
		: null;
	const closestStopDeparture = closestStopTimesStamp
		? new Date(+closestStopTimesStamp * 1000).toLocaleTimeString().slice(0, 5)
		: null;
	const hasUpdate =
		closestStopDeparture && closestStopDeparture !== scheduledTime;
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
				{hasUpdate && <span>{closestStopDeparture}</span>}
				<span className={hasUpdate ? "updated-time" : ""}>
					{" "}
					{scheduledTime}
				</span>
			</p>
		</div>
	);
};
