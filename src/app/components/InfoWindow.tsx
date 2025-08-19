"use client";

import { useEffect, useRef, useState } from "react";
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
	const { containerRef, isOverflowing, isScrolledToBottom, checkOverflow } =
		useOverflow<HTMLTableElement>();
	const { filteredTripUpdates, tripData } = useDataContext();
	const [localClosestStop, setLocalClosestStop] = useState<IDbData | null>(
		null,
	);
	const [tripStops, setTripStops] = useState<IDbData[]>([]);

	const [isAnimating, setIsAnimating] = useState(false);
	const [isTableAnimating, setIsTableAnimating] = useState(false);
	const [pendingTripStops, setPendingTripStops] = useState<IDbData[] | null>(
		null,
	);
	const prevTripStopsRef = useRef<IDbData[]>([]);
	const prevEffectiveStopRef = useRef<IDbData | null>(null);

	useEffect(() => {
		const effectiveStop = closestStopState || localClosestStop;
		checkOverflow();

		if (effectiveStop && prevEffectiveStopRef.current && tripStops.length > 0) {
			const prevSequence = prevEffectiveStopRef.current.stop_sequence;
			const currentSequence = effectiveStop.stop_sequence;

			if (currentSequence > prevSequence) {
				const getVisibleStops = (stops: IDbData[], stopSequence: number) => {
					return stops.filter((stop) => stop.stop_sequence >= stopSequence);
				};

				const prevVisibleStops = getVisibleStops(tripStops, prevSequence);
				const currentVisibleStops = getVisibleStops(tripStops, currentSequence);

				const currentVisibleIds = new Set(
					currentVisibleStops.map((s) => s.stop_id),
				);
				const nowHiddenStops = prevVisibleStops.filter(
					(s) => !currentVisibleIds.has(s.stop_id),
				);

				if (nowHiddenStops.length > 0) {
					setIsTableAnimating(true);

					setTimeout(() => {
						setIsTableAnimating(false);

						const newFilteredStops = tripStops.filter(
							(stop) => stop.stop_sequence >= currentSequence,
						);
						setTripStops(newFilteredStops);

						if (pendingTripStops) {
							setTripStops(pendingTripStops);
							prevTripStopsRef.current = [...pendingTripStops];
							setPendingTripStops(null);
						}
					}, 1000);
				}
			}
		}

		prevEffectiveStopRef.current = effectiveStop;
	}, [closestStopState, localClosestStop, tripStops, checkOverflow]);

	useEffect(() => {
		if (tripId) {
			const newTripStops = tripData.currentTrips
				.filter((stop) => stop.trip_id === tripId)
				.sort((a, b) => a.stop_sequence - b.stop_sequence);

			if (newTripStops.length > 0) {
				const getVisibleStops = (stops: IDbData[]) => {
					if (!effectiveStop?.stop_sequence) return stops;
					return stops.filter(
						(stop) => stop.stop_sequence >= effectiveStop.stop_sequence,
					);
				};

				const visibleNewStops = getVisibleStops(newTripStops);
				const visiblePrevStops = getVisibleStops(prevTripStopsRef.current);

				if (visiblePrevStops.length > 0) {
					const newStopIds = new Set(
						visibleNewStops.map((stop) => stop.stop_id),
					);

					const removedStops = visiblePrevStops.filter(
						(stop) => !newStopIds.has(stop.stop_id),
					);

					if (removedStops.length > 0) {
						setIsAnimating(true);

						setTimeout(() => {
							setIsAnimating(false);
							setTripStops(newTripStops);
							prevTripStopsRef.current = [...newTripStops];

							if (pendingTripStops) {
								setTripStops(pendingTripStops);
								prevTripStopsRef.current = [...pendingTripStops];
								setPendingTripStops(null);
							}
						}, 1200);

						return;
					}
				} else {
				}

				if (!isTableAnimating && !isAnimating) {
					setTripStops(newTripStops);
					prevTripStopsRef.current = [...newTripStops];

					if (!closestStopState && newTripStops.length > 0) {
						setLocalClosestStop(newTripStops[0]);
					}
				} else {
					setPendingTripStops(newTripStops);
				}
			}
		}
	}, [closestStopState, tripId, tripData.currentTrips]);

	const effectiveStop = closestStopState || localClosestStop;

	return (
		<div className="info-window" aria-live="polite">
			<div className="info-window__inner">
				<h2>
					<span className="bus-line">
						Linje {effectiveStop?.route_short_name},{" "}
					</span>
					<span id="final-station">{effectiveStop?.stop_headsign}</span>
				</h2>

				<div className={"table-wrapper"}>
					<Table
						ref={containerRef}
						className={`min-w-full ${isOverflowing ? "--overflowing" : ""} ${isScrolledToBottom ? "--at-bottom" : ""}`}
					>
						<TableCaption className="text-left text-zinc-300/80">
							Kommande hållplatser
						</TableCaption>
						<TableHeader className="sticky top-0">
							<TableRow>
								<TableHead className="text-white">Hållplats</TableHead>
								<TableHead className="text-right text-white">Ankomst</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody
							className={`tbody ${isTableAnimating ? "tbody-fade" : ""}`}
						>
							{tripStops.map((stop) => {
								if (
									effectiveStop?.stop_sequence &&
									stop.stop_sequence < effectiveStop?.stop_sequence
								)
									return null;
								const scheduledTime = normalizeTimeForDisplay(
									stop.departure_time,
								);
								const updatedTime = filteredTripUpdates
									.find((t) => t.trip.tripId === stop.trip_id)
									?.stopTimeUpdate.find((s) => s.stopId === stop.stop_id)
									?.departure?.time;
								const departureTimeString = updatedTime
									? new Date(+updatedTime * 1000)
											.toLocaleTimeString()
											.slice(0, 5)
									: null;
								const hasUpdate =
									departureTimeString && departureTimeString !== scheduledTime;

								const visibleStops = tripStops.filter(
									(s) =>
										!effectiveStop?.stop_sequence ||
										s.stop_sequence >= effectiveStop.stop_sequence,
								);
								const visibleIndex = visibleStops.findIndex(
									(s) => s.stop_id === stop.stop_id,
								);

								return (
									<TableRow
										key={stop.stop_id}
										className={`h-[44px] text-muted ${
											effectiveStop?.stop_sequence === stop.stop_sequence
												? "bg-muted/10 font-bold text-white"
												: ""
										} ${
											isTableAnimating && visibleIndex >= 0 && visibleIndex <= 9
												? `row-slide-${visibleIndex}`
												: ""
										} `}
									>
										<TableCell
											className={`font-medium ${effectiveStop?.stop_sequence === stop.stop_sequence ? "font-bold first-cell-pad" : ""}`}
										>
											<span>{stop.stop_name}</span>
										</TableCell>
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
			</div>
		</div>
	);
};
