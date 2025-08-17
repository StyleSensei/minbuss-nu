"use client";

import { useEffect, useState } from "react";
import { useDataContext } from "../context/DataContext";
import { useOverflow } from "../hooks/useOverflow";
import type { IDbData } from "@shared/models/IDbData";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface IInfoWindowProps {
	closestStopState: IDbData | null;
	tripId?: string;
}

export const InfoWindow = ({ closestStopState, tripId }: IInfoWindowProps) => {
	const { containerRef, isOverflowing, isScrolledToBottom } = useOverflow();
	const { filteredTripUpdates, tripData } = useDataContext();
	const [localClosestStop, setLocalClosestStop] = useState<IDbData | null>(
		null,
	);
	const [tripStops, setTripStops] = useState<IDbData[]>([]);
	useEffect(() => {
		if (tripId) {
			const tripStops = tripData.currentTrips
				.filter((stop) => stop.trip_id === tripId)
				.sort((a, b) => a.stop_sequence - b.stop_sequence);
			if (tripStops.length > 0) {
				if (!closestStopState) {
					setLocalClosestStop(tripStops[0]);
				}
				setTripStops(tripStops);
			}
		}
	}, [closestStopState, tripId, tripData.currentTrips]);

	const effectiveStop = closestStopState || localClosestStop;

	return (
		<div
			className={`info-window ${isOverflowing ? "--overflowing" : ""} ${isScrolledToBottom ? "--at-bottom" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			<h2>
				<span className="bus-line">{effectiveStop?.route_short_name}, </span>
				<span id="final-station">{effectiveStop?.stop_headsign}</span>
			</h2>

			<Table>
				<TableCaption>Hållplatser</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[200px] text-white">Hållplats</TableHead>
						<TableHead className="text-right text-white">Ankomst</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{tripStops.map((stop) => {
						if (
							effectiveStop?.stop_sequence &&
							stop.stop_sequence < effectiveStop?.stop_sequence
						)
							return null;
						const scheduledTime = normalizeTimeForDisplay(stop.departure_time);
						const updatedTime = filteredTripUpdates
							.find((t) => t.trip.tripId === stop.trip_id)
							?.stopTimeUpdate.find((s) => s.stopId === stop.stop_id)
							?.departure?.time;
						const departureTimeString = updatedTime
							? new Date(+updatedTime * 1000).toLocaleTimeString().slice(0, 5)
							: null;
						const hasUpdate =
							departureTimeString && departureTimeString !== scheduledTime;
						return (
							<TableRow
								key={stop.stop_id}
								className={`h-[44px] ${effectiveStop?.stop_sequence === stop.stop_sequence ? "bg-muted/20" : ""}`}
							>
								<TableCell className="font-medium">{stop.stop_name}</TableCell>
								<TableCell className="text-right">
									{hasUpdate && <span>{departureTimeString}</span>}
									<span className={hasUpdate ? "updated-time" : ""}>
										{" "}
										{scheduledTime}
									</span>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
};
