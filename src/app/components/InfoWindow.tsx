"use client";

import type { IDbData } from "@shared/models/IDbData";
import { usePathname, useSearchParams } from "next/navigation";
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
import { parseOperatorFromRealtimePathname } from "../paths";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";
import { gtfsRouteVehicleLabelSv } from "../utilities/gtfsRouteTypeLabel";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import { filterStopBoardByLines } from "../utilities/stopBoardLineFilter";
import { Button } from "./Button";
import { PanelCloseButton } from "./PanelCloseButton";

interface IInfoWindowProps extends HTMLAttributes<HTMLDivElement> {
	closestStopState: IDbData | null;
	tripId?: string;
	googleMapRef?: React.MutableRefObject<google.maps.Map | null>;
	onClose?: () => void;
	onTripStopsLoaded?: (stops: IDbData[]) => void;
}

export const InfoWindow = ({
	closestStopState,
	tripId,
	googleMapRef,
	onClose,
	onTripStopsLoaded,
	...rest
}: IInfoWindowProps) => {
	const { containerRef, isOverflowing, isScrolledToBottom, checkOverflow } =
		useOverflow<HTMLTableElement>();
	const {
		filteredTripUpdates,
		tripData,
		filteredVehicles,
		stopBoardData,
		selectedStopLineFilter,
		selectedStopPlatformFilter,
		selectedStopModeFilter,
		selectedStopForSchedule,
		selectedStopRouteLines,
	} = useDataContext();
	const isPinnedStopMode = selectedStopForSchedule !== null;
	const filteredStopBoard = useMemo(
		() =>
			filterStopBoardByLines(
				stopBoardData.departures,
				stopBoardData.vehicles,
				selectedStopLineFilter,
				selectedStopPlatformFilter,
				selectedStopModeFilter,
			),
		[
			selectedStopLineFilter,
			selectedStopModeFilter,
			selectedStopPlatformFilter,
			stopBoardData.departures,
			stopBoardData.vehicles,
		],
	);
	const realtimeVehicles = isPinnedStopMode
		? filteredStopBoard.vehicles
		: filteredVehicles.data;
	const realtimeTripUpdates = isPinnedStopMode
		? stopBoardData.tripUpdates
		: filteredTripUpdates;
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const operatorForFetch = useMemo(() => {
		const pathOp = parseOperatorFromRealtimePathname(pathname);
		const q = searchParams.get("operator")?.trim().toLowerCase() ?? "";
		return closestStopState?.operator ?? ((pathOp ?? q) || "sl");
	}, [pathname, searchParams, closestStopState?.operator]);
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
	const tripStopsRef = useRef(tripStops);
	tripStopsRef.current = tripStops;
	const pendingTripStopsRef = useRef(pendingTripStops);
	pendingTripStopsRef.current = pendingTripStops;
	const effectiveStop = closestStopState || localClosestStop;
	const isMobile = useIsMobile();
	const [isCollapsed, setIsCollapsed] = useState(true);
	/** Collapse är mobil-only; desktop ska alltid visa overflow-indikator. */
	const showOverflowChrome = !isMobile || !isCollapsed;

	const getVisibleStops = useCallback(
		(stops: IDbData[], sequenceNumber?: number) => {
			const sequence = sequenceNumber ?? effectiveStop?.stop_sequence;
			if (!sequence) return stops;
			return stops.filter((stop) => stop.stop_sequence >= sequence);
		},
		[effectiveStop?.stop_sequence],
	);

	const completeAnimation = useCallback((newStops: IDbData[]) => {
		setIsTableAnimating(false);
		setTripStops(newStops);
		prevTripStopsRef.current = [...newStops];

		const pending = pendingTripStopsRef.current;
		if (pending) {
			setTripStops(pending);
			prevTripStopsRef.current = [...pending];
			setPendingTripStops(null);
		}
	}, []);

	const tripStopsSig = useMemo(
		() =>
			tripStops.length === 0
				? ""
				: `${tripStops.length}:${tripStops.map((s) => `${s.stop_id}:${s.stop_sequence}`).join("|")}`,
		[tripStops],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: do not depend on `effectiveStop` object identity or raw `tripStops` reference (parent refresh). Use `tripStopsSig` + stop_id/sequence. `completeAnimation` is stable (reads pending via ref).
	useEffect(() => {
		checkOverflow();

		const stops = tripStopsRef.current;
		if (effectiveStop && prevEffectiveStopRef.current && stops.length > 0) {
			const prevSequence = prevEffectiveStopRef.current.stop_sequence;
			const currentSequence = effectiveStop.stop_sequence;

			if (currentSequence > prevSequence) {
				const prevVisibleStops = getVisibleStops(stops, prevSequence);
				const currentVisibleStops = getVisibleStops(stops, currentSequence);

				const currentVisibleIds = new Set(
					currentVisibleStops.map((s) => s.stop_id),
				);
				const nowHiddenStops = prevVisibleStops.filter(
					(s) => !currentVisibleIds.has(s.stop_id),
				);

				if (nowHiddenStops.length > 0) {
					setIsTableAnimating(true);

					const newFilteredStops = stops.filter(
						(stop) => stop.stop_sequence >= currentSequence,
					);

					setTimeout(() => completeAnimation(newFilteredStops), 1000);
				}
			}
		}

		prevEffectiveStopRef.current = effectiveStop;
	}, [
		tripStopsSig,
		checkOverflow,
		effectiveStop?.stop_id,
		effectiveStop?.stop_sequence,
		getVisibleStops,
	]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: never use `containerRef.current` as a dep. `tripStopsSig` re-attaches ResizeObserver when stop rows meaningfully change (not only reference churn).
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
	}, [checkOverflow, tripStopsSig]);

	const syncTripStops = useCallback(
		(newTripStops: IDbData[]) => {
			if (newTripStops.length === 0) return;
			onTripStopsLoaded?.(newTripStops);

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
		},
		[
			closestStopState,
			isTableAnimating,
			getVisibleStops,
			completeAnimation,
			onTripStopsLoaded,
		],
	);

	useEffect(() => {
		if (!tripId) return;

		const prevTripId = prevTripStopsRef.current[0]?.trip_id;
		if (prevTripId && prevTripId !== tripId) {
			setTripStops([]);
			prevTripStopsRef.current = [];
			setPendingTripStops(null);
		}

		const fromCurrentTrips = tripData.currentTrips
			.filter((stop) => stop.trip_id === tripId)
			.sort((a, b) => a.stop_sequence - b.stop_sequence);

		if (fromCurrentTrips.length > 1) {
			syncTripStops(fromCurrentTrips);
			return;
		}
		if (
			prevTripStopsRef.current.length > 1 &&
			prevTripStopsRef.current[0]?.trip_id === tripId
		) {
			return;
		}

		let cancelled = false;
		const url = appendOperatorToApiUrl(
			`/api/trips/${encodeURIComponent(tripId)}/stops`,
			operatorForFetch,
		);

		fetch(url)
			.then((res) => {
				if (!res.ok) {
					throw new Error(`trip stops ${res.status}`);
				}
				return res.json() as Promise<{ stops?: IDbData[] }>;
			})
			.then((body) => {
				if (cancelled) return;
				const fetched = (body.stops ?? [])
					.filter((stop) => stop.trip_id === tripId)
					.sort((a, b) => a.stop_sequence - b.stop_sequence);
				syncTripStops(fetched);
			})
			.catch((error) => {
				if (!cancelled) {
					console.error("Failed to fetch trip stops:", error);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [tripId, tripData.currentTrips, operatorForFetch, syncTripStops]);

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

	const isInTraffic = useMemo(() => {
		if (!tripId) return false;
		return realtimeVehicles.some((v) => v.trip?.tripId === tripId);
	}, [realtimeVehicles, tripId]);

	const vehicleLabel = gtfsRouteVehicleLabelSv(
		effectiveStop?.route_type ?? tripStops[0]?.route_type,
	);

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
				{onClose ? <PanelCloseButton onClose={onClose} /> : null}
				<h2>
					<span className="bus-line">
						Linje {effectiveStop?.route_short_name},{" "}
					</span>
					<span id="final-station">{effectiveStop?.stop_headsign}</span>
				</h2>
				{tripId ? (
					<p
						className="info-window__traffic-status text-sm text-zinc-300/80 flex items-center gap-2"
						role="status"
					>
						<span
							className={`shrink-0 w-2 h-2 rounded-full ${isInTraffic ? "bg-accent" : "bg-destructive"}`}
							aria-hidden
						/>
						<span>
							{isInTraffic
								? `${vehicleLabel} är i trafik`
								: `${vehicleLabel} är inte i trafik än`}
						</span>
					</p>
				) : null}

				<div className="table-wrapper">
					<Table
						ref={containerRef}
						onScroll={checkOverflow}
						className={`min-w-full ${isOverflowing && showOverflowChrome ? "--overflowing" : ""} ${isScrolledToBottom && showOverflowChrome ? "--at-bottom" : ""} ${isCollapsed && isMobile ? "--collapsed" : ""}`}
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
								const updatedTime = realtimeTripUpdates
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
