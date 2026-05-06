"use client";

import type { IDbData } from "@shared/models/IDbData";
import { chevronsCollapse, chevronsExpand } from "public/icons";
import {
	type HTMLAttributes,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import colors from "../colors";
import { useDataContext } from "../context/DataContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useOverflow } from "../hooks/useOverflow";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import { Button } from "./Button";

interface IInfoWindowProps extends HTMLAttributes<HTMLDivElement> {
	closestStopState: IDbData | null;
	tripId?: string;
	googleMapRef?: React.MutableRefObject<google.maps.Map | null>;
}

export const InfoWindow = ({
	closestStopState,
	tripId,
	googleMapRef,
	...rest
}: IInfoWindowProps) => {
	const { containerRef, isOverflowing, isScrolledToBottom, checkOverflow } =
		useOverflow<HTMLTableElement>();
	const { filteredTripUpdates, tripData } = useDataContext();
	const [localClosestStop, setLocalClosestStop] = useState<IDbData | null>(
		null,
	);
	const [tripStops, setTripStops] = useState<IDbData[]>([]);
	const [isTableAnimating, setIsTableAnimating] = useState(false);
	const [pendingTripStops, setPendingTripStops] = useState<IDbData[] | null>(
		null,
	);
	const prevTripStopsRef = useRef<IDbData[]>([]);
	const prevEffectiveStopRef = useRef<IDbData | null>(null);
	const effectiveStop = closestStopState || localClosestStop;
	const isMobile = useIsMobile();
	const [isCollapsed, setIsCollapsed] = useState(true);

	const getVisibleStops = useCallback(
		(stops: IDbData[], sequenceNumber?: number) => {
			const sequence = sequenceNumber ?? effectiveStop?.stop_sequence;
			if (!sequence) return stops;
			return stops.filter((stop) => stop.stop_sequence >= sequence);
		},
		[effectiveStop?.stop_sequence],
	);

	const completeAnimation = useCallback(
		(newStops: IDbData[]) => {
			setIsTableAnimating(false);
			setTripStops(newStops);
			prevTripStopsRef.current = [...newStops];

			if (pendingTripStops) {
				setTripStops(pendingTripStops);
				prevTripStopsRef.current = [...pendingTripStops];
				setPendingTripStops(null);
			}
		},
		[pendingTripStops],
	);

	useEffect(() => {
		checkOverflow();

		if (effectiveStop && prevEffectiveStopRef.current && tripStops.length > 0) {
			const prevSequence = prevEffectiveStopRef.current.stop_sequence;
			const currentSequence = effectiveStop.stop_sequence;

			if (currentSequence > prevSequence) {
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

					const newFilteredStops = tripStops.filter(
						(stop) => stop.stop_sequence >= currentSequence,
					);

					setTimeout(() => completeAnimation(newFilteredStops), 1000);
				}
			}
		}

		prevEffectiveStopRef.current = effectiveStop;
	}, [
		tripStops,
		checkOverflow,
		effectiveStop?.stop_sequence,
		getVisibleStops,
		completeAnimation,
		effectiveStop,
	]);
	effectiveStop;
	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {
			checkOverflow();
		});
		ro.observe(el);
		const t = window.setTimeout(() => checkOverflow(), 50);
		return () => {
			window.clearTimeout(t);
			ro.disconnect();
		};
	}, [checkOverflow, containerRef.current]);

	useEffect(() => {
		if (!tripId) return;

		const newTripStops = tripData.currentTrips
			.filter((stop) => stop.trip_id === tripId)
			.sort((a, b) => a.stop_sequence - b.stop_sequence);

		if (newTripStops.length === 0) return;

		if (prevTripStopsRef.current.length === 0) {
			setTripStops(newTripStops);
			prevTripStopsRef.current = [...newTripStops];

			if (!closestStopState && newTripStops.length > 0) {
				setLocalClosestStop(newTripStops[0]);
			}
			return;
		}

		const visibleNewStops = getVisibleStops(newTripStops);
		const visiblePrevStops = getVisibleStops(prevTripStopsRef.current);

		if (visiblePrevStops.length > 0) {
			const newStopIds = new Set(visibleNewStops.map((stop) => stop.stop_id));
			const removedStops = visiblePrevStops.filter(
				(stop) => !newStopIds.has(stop.stop_id),
			);

			if (removedStops.length > 0) {
				setIsTableAnimating(true);
				setTimeout(() => completeAnimation(newTripStops), 1000);
				return;
			}
		}

		if (!isTableAnimating) {
			setTripStops(newTripStops);
			prevTripStopsRef.current = [...newTripStops];
		} else {
			setPendingTripStops(newTripStops);
		}
	}, [
		closestStopState,
		tripId,
		tripData.currentTrips,
		isTableAnimating,
		getVisibleStops,
		completeAnimation,
	]);

	useEffect(() => {
		if (isCollapsed && isMobile) {
			containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}
	}, [isCollapsed, isMobile, containerRef.current]);

	const visibleStops = useMemo(() => {
		return tripStops.filter(
			(s) =>
				!effectiveStop?.stop_sequence ||
				s.stop_sequence >= effectiveStop.stop_sequence,
		);
	}, [tripStops, effectiveStop?.stop_sequence]);

	const handleOnClick = (stop: IDbData) => {
		if (googleMapRef?.current) {
			const position = new google.maps.LatLng(+stop.stop_lat, +stop.stop_lon);
			googleMapRef.current.panTo(position);
			googleMapRef.current.setZoom(18);
		}
	};

	return (
		<div className="info-window" aria-live="polite" {...rest}>
			<div className="info-window__inner">
				<h2>
					<span className="bus-line">
						Linje {effectiveStop?.route_short_name},{" "}
					</span>
					<span id="final-station">{effectiveStop?.stop_headsign}</span>
				</h2>

				<div className="table-wrapper">
					<Table
						ref={containerRef}
						onScroll={checkOverflow}
						className={`min-w-full ${isOverflowing && !isCollapsed ? "--overflowing" : ""} ${isScrolledToBottom && !isCollapsed ? "--at-bottom" : ""} ${isCollapsed && isMobile ? "--collapsed" : ""}`}
					>
						<TableCaption className="text-left text-zinc-300/80">
							Kommande hållplatser
						</TableCaption>
						<TableHeader className="sticky top-0">
							<TableRow>
								<TableHead className="text-white font-bold">
									Hållplats
								</TableHead>
								<TableHead className="text-right text-white font-bold">
									Ankomst
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody
							className={`tbody ${isTableAnimating ? "tbody-fade" : ""}`}
						>
							{visibleStops.map((stop, index) => {
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

								return (
									<TableRow
										key={stop.stop_id}
										className={`h-[44px] text-muted ${
											effectiveStop?.stop_sequence === stop.stop_sequence
												? "bg-muted/10 font-bold text-white"
												: ""
										} ${
											isTableAnimating && index <= 9 ? `row-slide-${index}` : ""
										} `}
									>
										<TableCell
											className={`font-medium ${effectiveStop?.stop_sequence === stop.stop_sequence ? "font-bold first-cell-pad" : ""}`}
										>
											<button
												type="button"
												className="row-button"
												onClick={() => handleOnClick(stop)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														handleOnClick(stop);
													}
												}}
												aria-label={`Visa position för hållplats ${stop.stop_name}`}
												title="Visa position"
											>
												<span>{stop.stop_name}</span>
											</button>
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

					<div className="button-wrapper --collapsible">
						<Button
							title={isCollapsed ? "Expandera vy" : "Minska vy"}
							className="--collapsible"
							path={!isCollapsed ? chevronsCollapse.path : chevronsExpand.path}
							// path2={ !isCollapsed ? '': chevronsExpand.path2}
							color={colors.secondary}
							viewBox={
								!isCollapsed ? chevronsCollapse.viewBox : chevronsExpand.viewBox
							}
							iconSize={18}
							fill={!isCollapsed ? chevronsCollapse.fill : chevronsExpand.fill}
							onClick={() => {
								setIsCollapsed(!isCollapsed);
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
