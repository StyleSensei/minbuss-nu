import type { IDbData } from "@shared/models/IDbData";
import { MapPinned } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { IVehiclePosition } from "@/shared/models/IVehiclePosition";
import { arrow } from "../../../public/icons";
import { useDataContext } from "../context/DataContext";
import { useOverflow } from "../hooks/useOverflow";
import { Paths } from "../paths";
import { convertGTFSTimeToDate } from "../utilities/convertGTFSTimeToDate";
import { getClosest } from "../utilities/getClosest";
import {
	gtfsRouteModeShortLabelSv,
	gtfsRouteVehicleLabelSv,
} from "../utilities/gtfsRouteTypeLabel";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import { CurrentTripsLoader } from "./CurrentTripsLoader";
import { Icon } from "./Icon";

interface ICurrentTripsProps {
	onTripSelect?: (tripId: string) => void;
	mapRef?: React.MutableRefObject<google.maps.Map | null>;
	closestStop?: IDbData;
	followedTripId?: string | null;
}

function tripIdsSignature(arr: IDbData[]): string {
	return arr.map((t) => `${t.trip_id}:${t.stop_id}:${t.stop_sequence}`).join("|");
}

function stopIdMatchesBoardRow(
	rowStopId: string | undefined,
	boardStopId: string | undefined,
): boolean {
	if (!rowStopId || !boardStopId) return rowStopId === boardStopId;
	if (rowStopId === boardStopId) return true;
	if (rowStopId.length > 3 && boardStopId.length > 3) {
		return rowStopId.slice(0, -3) === boardStopId.slice(0, -3);
	}
	return false;
}

function resolveBoardStopSequenceForTripAtBoard(
	tripId: string,
	board: IDbData,
	currentTrips: IDbData[],
	upcomingTrips: IDbData[],
): number | undefined {
	const tryRows = (rows: IDbData[]): number | undefined => {
		const byStopId = rows.find(
			(s) =>
				s.trip_id === tripId &&
				stopIdMatchesBoardRow(s.stop_id, board.stop_id),
		);
		if (byStopId != null) return byStopId.stop_sequence;
		const byName = rows.find(
			(s) =>
				s.trip_id === tripId &&
				s.stop_name.trim() === board.stop_name.trim(),
		);
		return byName?.stop_sequence;
	};
	return tryRows(currentTrips) ?? tryRows(upcomingTrips);
}

function injectFollowedTripRowAtBoard(
	tripId: string,
	board: IDbData,
	boardSeq: number | undefined,
	currentTrips: IDbData[],
	upcomingTrips: IDbData[],
): IDbData | undefined {
	const bySeqOrStopId = (rows: IDbData[]) => {
		if (boardSeq != null) {
			const m = rows.find(
				(s) =>
					s.trip_id === tripId &&
					(s.stop_sequence === boardSeq ||
						stopIdMatchesBoardRow(s.stop_id, board.stop_id)),
			);
			if (m) return m;
		}
		return rows.find(
			(s) =>
				s.trip_id === tripId &&
				s.stop_name.trim() === board.stop_name.trim(),
		);
	};
	return bySeqOrStopId(currentTrips) ?? bySeqOrStopId(upcomingTrips);
}

type TableAnimSync = {
	committed: IDbData[];
	animating: boolean;
	timeoutId: number | null;
	pending: IDbData[] | null;
	towardSig: string | null;
	removalTarget: IDbData[] | null;
};

export const CurrentTrips = ({
	onTripSelect,
	mapRef,
	closestStop,
	followedTripId = null,
}: ICurrentTripsProps) => {
	const { containerRef, isOverflowing, checkOverflow, isScrolledToBottom } =
		useOverflow();
	const {
		filteredVehicles,
		tripData,
		filteredTripUpdates,
		userPosition,
		isLoading,
		selectedStopRouteLines,
		activeFollowedTripId,
		activeVehicleBoardStop,
	} = useDataContext();
	const effectiveFollowedTripId = activeFollowedTripId ?? followedTripId ?? null;
	const router = useRouter();
	const searchParams = useSearchParams();
	const lastLinePickAtRef = useRef(0);
	const [hasFilteredOnce, setHasFilteredOnce] = useState(false);

	const [displayTrips, setDisplayTrips] = useState<IDbData[]>([]);
	const [isTableAnimating, setIsTableAnimating] = useState(false);
	const tableAnim = useRef<TableAnimSync>({
		committed: [],
		animating: false,
		timeoutId: null,
		pending: null,
		towardSig: null,
		removalTarget: null,
	});
	const closestStopToUse = closestStop ?? userPosition?.closestStop;
	const isPinnedStopMode = selectedStopRouteLines !== null;
	const urlLine = searchParams.get("linje")?.trim().toUpperCase() ?? "";

	const pickLineInModal = useCallback(
		(routeShortName: string) => {
			const now = Date.now();
			if (now - lastLinePickAtRef.current < 350) {
				return;
			}
			lastLinePickAtRef.current = now;
			router.push(
				`${Paths.Search}?linje=${encodeURIComponent(routeShortName)}`,
			);
		},
		[router],
	);

	const activeVehiclePositions = useMemo(
		() =>
			new Set(
				filteredVehicles.data.map((bus: IVehiclePosition) => bus.trip.tripId),
			),
		[filteredVehicles.data],
	);

	const vehiclePositionSig = filteredVehicles.data
		.map(
			(v) =>
				`${v.trip?.tripId ?? ""}:${v.position.latitude.toFixed(4)}:${v.position.longitude.toFixed(4)}`,
		)
		.sort()
		.join("|");

	const getUpdatedDepartureTime = useCallback(
		(tripId: string, stop: IDbData | null | undefined): string | undefined => {
			if (!stop?.stop_id) return undefined;
			if (!filteredTripUpdates.length) return undefined;

			const tripUpdate = filteredTripUpdates.find(
				(t) => t.trip.tripId === tripId,
			);

			if (!tripUpdate?.stopTimeUpdate?.length) return undefined;

			const stopUpdate =
				tripUpdate.stopTimeUpdate.find((s) => s.stopId === stop.stop_id) ??
				tripUpdate.stopTimeUpdate.find(
					(s) => s.stopId.slice(0, -3) === stop.stop_id.slice(0, -3),
				);

			if (!stopUpdate?.departure?.time) return undefined;

			const departureDate = new Date(Number(stopUpdate.departure.time) * 1000);
			return departureDate.toLocaleTimeString().slice(0, 5);
		},
		[filteredTripUpdates],
	);

	const getDepartureInstantForFilter = useCallback(
		(trip: IDbData, boardRef: IDbData): Date => {
			if (!filteredTripUpdates.length) {
				return convertGTFSTimeToDate(trip.departure_time);
			}
			const tripUpdate = filteredTripUpdates.find(
				(t) => t.trip.tripId === trip.trip_id,
			);
			const su = tripUpdate?.stopTimeUpdate;
			if (!su?.length) {
				return convertGTFSTimeToDate(trip.departure_time);
			}
			const byTripStop = trip.stop_id
				? su.find(
						(s) =>
							s.stopId === trip.stop_id && s.departure?.time != null,
					)
				: undefined;
			if (byTripStop?.departure?.time != null) {
				return new Date(Number(byTripStop.departure.time) * 1000);
			}
			if (boardRef?.stop_id) {
				const byBoard = su.find(
					(s) => s.stopId === boardRef.stop_id && s.departure?.time != null,
				);
				if (byBoard?.departure?.time != null) {
					return new Date(Number(byBoard.departure.time) * 1000);
				}
			}
			return convertGTFSTimeToDate(trip.departure_time);
		},
		[filteredTripUpdates],
	);

	useEffect(() => {
		function syncDeparturesDisplay(incoming: IDbData[]) {
			const b = tableAnim.current;
			const incSig = tripIdsSignature(incoming);

			if (b.committed.length === 0) {
				setDisplayTrips(incoming);
				b.committed = [...incoming];
				return;
			}

			if (incSig === tripIdsSignature(b.committed)) {
				if (!b.animating) {
					setDisplayTrips(incoming);
					b.committed = [...incoming];
				} else {
					b.pending = [...incoming];
				}
				return;
			}

			if (b.animating && b.towardSig != null && incSig === b.towardSig) {
				b.pending = [...incoming];
				return;
			}

			const newIds = new Set(incoming.map((t) => t.trip_id));
			const removed = b.committed.filter((t) => !newIds.has(t.trip_id));

			if (removed.length > 0) {
				if (b.timeoutId != null) {
					window.clearTimeout(b.timeoutId);
				}
				b.removalTarget = [...incoming];
				b.towardSig = incSig;
				b.animating = true;
				setIsTableAnimating(true);
				b.timeoutId = window.setTimeout(() => {
					const bag = tableAnim.current;
					bag.timeoutId = null;
					const target = bag.removalTarget ?? [];
					bag.removalTarget = null;
					bag.towardSig = null;
					bag.animating = false;
					setIsTableAnimating(false);
					setDisplayTrips(target);
					bag.committed = [...target];
					const p = bag.pending;
					if (p) {
						bag.pending = null;
						setDisplayTrips(p);
						bag.committed = [...p];
					}
				}, 1000);
				return;
			}

			if (!b.animating) {
				setDisplayTrips(incoming);
				b.committed = [...incoming];
			} else {
				b.pending = [...incoming];
			}
		}

		function filterTrips() {
			const anim = tableAnim.current;
			if (anim.timeoutId != null) {
				window.clearTimeout(anim.timeoutId);
				anim.timeoutId = null;
			}
			if (anim.animating) {
				anim.animating = false;
				setIsTableAnimating(false);
				anim.towardSig = null;
				const target = anim.removalTarget ?? [];
				anim.removalTarget = null;
				setDisplayTrips(target);
				anim.committed = [...target];
				const p = anim.pending;
				if (p) {
					anim.pending = null;
					setDisplayTrips(p);
					anim.committed = [...p];
				}
			}

			let newList: IDbData[];
			if (closestStopToUse) {
				const boardStop = closestStopToUse;
				const stopNameNorm = boardStop.stop_name.trim();
				const boardStopSequenceForFollowed =
					effectiveFollowedTripId && closestStopToUse
						? resolveBoardStopSequenceForTripAtBoard(
								effectiveFollowedTripId,
								closestStopToUse,
								tripData.currentTrips,
								tripData.upcomingTrips,
							)
						: undefined;

			
				/** RT-försening: följd tur vid bräda får ligga kvar längre efter "passerad" tid. */
				const FOLLOWED_MAX_PAST_MIN = 20;

				function rowPassesDepartureTimeRule(trip: IDbData): boolean {
					try {
						const departureTime = getDepartureInstantForFilter(
							trip,
							boardStop,
						);
						const minutesSince =
							(Date.now() - departureTime.getTime()) / (1000 * 60);

						if (
							effectiveFollowedTripId &&
							trip.trip_id === effectiveFollowedTripId
						) {
							const vehicleBoard =
								activeVehicleBoardStop?.trip_id === trip.trip_id
									? activeVehicleBoardStop
									: null;
							let passedThisStopByVehicle =
								vehicleBoard != null &&
								vehicleBoard.stop_sequence > trip.stop_sequence;

							if (!passedThisStopByVehicle) {
								const veh = filteredVehicles.data.find(
									(v: IVehiclePosition) => v.trip.tripId === trip.trip_id,
								);
								if (veh?.position) {
									const stopsOnTrip = tripData.currentTrips
										.filter((s) => s.trip_id === trip.trip_id)
										.sort((a, b) => a.stop_sequence - b.stop_sequence);
									if (stopsOnTrip.length > 0) {
										const closest = getClosest(
											stopsOnTrip,
											veh.position.latitude,
											veh.position.longitude,
										) as IDbData;
										passedThisStopByVehicle =
											closest.stop_sequence > trip.stop_sequence;
									}
								}
							}

							if (passedThisStopByVehicle) {
								return false;
							}

							let atCurrentBoardStop: boolean;
							if (vehicleBoard != null) {
								atCurrentBoardStop =
									stopIdMatchesBoardRow(
										trip.stop_id,
										vehicleBoard.stop_id,
									) ||
									trip.stop_sequence === vehicleBoard.stop_sequence ||
									stopIdMatchesBoardRow(
										trip.stop_id,
										boardStop.stop_id,
									) ||
									(boardStopSequenceForFollowed != null &&
										trip.stop_sequence ===
											boardStopSequenceForFollowed);
							} else {
								atCurrentBoardStop =
									stopIdMatchesBoardRow(
										trip.stop_id,
										boardStop.stop_id,
									) ||
									(boardStopSequenceForFollowed != null &&
										trip.stop_sequence ===
											boardStopSequenceForFollowed);
							}

							if (minutesSince <= 0) return true;

							const keep =
								atCurrentBoardStop &&
								minutesSince <= FOLLOWED_MAX_PAST_MIN;
							return keep;
						}

						if (minutesSince <= 0) return true;

						const PAST_GRACE_MIN = 0.5;
						if (minutesSince <= PAST_GRACE_MIN) return true;
						return false;
					} catch (error) {
						console.error(`Error checking trip ${trip.trip_id}:`, error);
						return true;
					}
				}

				newList = tripData.upcomingTrips.filter((trip) => {
					const rowNameNorm = trip.stop_name.trim();
					const nameMatchesBoard = rowNameNorm === stopNameNorm;
					const followedRowAlignsWithBoard =
						effectiveFollowedTripId != null &&
						trip.trip_id === effectiveFollowedTripId &&
						boardStopSequenceForFollowed != null &&
						trip.stop_sequence === boardStopSequenceForFollowed;

					if (!nameMatchesBoard && !followedRowAlignsWithBoard) {
						return false;
					}
						return rowPassesDepartureTimeRule(trip);
				});

				if (effectiveFollowedTripId && closestStopToUse) {
					const injected = injectFollowedTripRowAtBoard(
						effectiveFollowedTripId,
						closestStopToUse,
						boardStopSequenceForFollowed,
						tripData.currentTrips,
						tripData.upcomingTrips,
					);
			
					if (injected) {
						newList = [
							injected,
							...newList.filter(
								(t) => t.trip_id !== effectiveFollowedTripId,
							),
						];
					}
				}

				newList = newList.filter(rowPassesDepartureTimeRule);
				newList = [...newList].sort((a, b) => {
					const ta = getDepartureInstantForFilter(a, boardStop).getTime();
					const tb = getDepartureInstantForFilter(b, boardStop).getTime();
					if (ta !== tb) return ta - tb;
					return (a.trip_id ?? "").localeCompare(b.trip_id ?? "");
				});
			} else {
				newList = tripData.upcomingTrips;
			}
			syncDeparturesDisplay(newList);
		}

		filterTrips();
		setHasFilteredOnce(true);

		const intervalId = setInterval(filterTrips, 30000);

		return () => {
			window.clearInterval(intervalId);
			const t = tableAnim.current.timeoutId;
			if (t != null) {
				window.clearTimeout(t);
				tableAnim.current.timeoutId = null;
			}
		};
	}, [
		closestStopToUse?.stop_id,
		closestStopToUse?.stop_sequence,
		closestStopToUse?.stop_name,
		tripData.upcomingTrips,
		tripData.currentTrips,
		getUpdatedDepartureTime,
		getDepartureInstantForFilter,
		followedTripId,
		activeFollowedTripId,
		activeVehicleBoardStop?.stop_id,
		activeVehicleBoardStop?.stop_sequence,
		activeVehicleBoardStop?.trip_id,
		activeVehiclePositions,
		vehiclePositionSig,
	]);

	let nextBus: IDbData | undefined;
	let rest: IDbData[] = [];

	if (displayTrips.length > 0) {
		[nextBus, ...rest] = displayTrips;
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

	const routeMeta =
		nextBus ??
		displayTrips[0] ??
		tripData.upcomingTrips[0] ??
		tripData.currentTrips[0];
	const vehicleLabel = gtfsRouteVehicleLabelSv(routeMeta?.route_type);

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

	useLayoutEffect(() => {
		if (!hasFilteredOnce || isLoading) return;
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
	}, [
		checkOverflow,
		hasFilteredOnce,
		isLoading,
		hasTripsToDisplay,
		displayTrips.length,
		tripData.upcomingTrips.length,
		closestStopToUse?.stop_id,
		selectedStopRouteLines?.join("|") ?? "",
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
						{isPinnedStopMode && closestStopToUse
							? closestStopToUse.stop_name
							: "Avgångar närmast dig"}
					</h2>
					{selectedStopRouteLines && selectedStopRouteLines.length > 0 ? (
						<section
							className="current-trips__line-picker"
							aria-label="Byt linje för denna hållplats"
						>
							{selectedStopRouteLines.map((name) => {
								const active = name.toUpperCase() === urlLine;
								return (
									<button
										key={name}
										type="button"
										className={`current-trips__line-btn${active ? " current-trips__line-btn--active" : ""}`}
										onPointerUp={(e) => {
											e.stopPropagation();
											pickLineInModal(name);
										}}
										onTouchEnd={(e) => {
											e.stopPropagation();
											pickLineInModal(name);
										}}
										onClick={(e) => {
											e.stopPropagation();
											pickLineInModal(name);
										}}
									>
										{name}
									</button>
								);
							})}
						</section>
					) : null}
					<p title={routeMeta?.route_desc ?? undefined}>
						<span className="text-muted-foreground dark">Linje: </span>
						<span className="font-bold">{routeShortName}</span>
						{routeMeta?.route_type != null && (
							<span className="text-muted-foreground dark">
								{" "}
								· {gtfsRouteModeShortLabelSv(routeMeta.route_type)}
							</span>
						)}
					</p>
					{routeMeta?.route_long_name ? (
						<p className="route-long-name text-sm text-muted-foreground dark">
							{routeMeta.route_long_name}
						</p>
					) : null}
					{closestStopToUse && !isPinnedStopMode && (
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
							title={
								isActive ? "Visa position" : `${vehicleLabel} är inte i trafik`
							}
							aria-label={`Visa nästa avgång mot ${nextBus?.stop_headsign} som avgår ${nextBusUpdatedTime || nextBusScheduledTime}`}
							className={`next-departure ${isActive ? " --active" : ""}${isTableAnimating ? " row-slide-0" : ""}`}
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
										? `${vehicleLabel} är i trafik`
										: `${vehicleLabel} är inte i trafik än`}
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
								<tbody
									className={`tbody${isTableAnimating ? " tbody-fade" : ""}`}
								>
									{rest.map((trip, i) => {
										const updatedTime = getUpdatedDepartureTime(
											trip?.trip_id,
											closestStopToUse,
										);
										const scheduledTime = normalizeTimeForDisplay(
											trip?.departure_time?.slice(0, 5),
										);
										const hasUpdate =
											updatedTime && updatedTime !== scheduledTime;
										const isActive = activeVehiclePositions.has(trip.trip_id);
										const rowVehicleLabel = gtfsRouteVehicleLabelSv(
											trip.route_type,
										);

										const rowSlideClass =
											isTableAnimating && i < 9 ? ` row-slide-${i + 1}` : "";
										return (
											<tr
												// biome-ignore lint/suspicious/noArrayIndexKey: trip_id not unique across rows
												key={trip?.trip_id + i}
												className={`trip-row  ${isActive ? " --active" : ""}${rowSlideClass}`}
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
																: `${rowVehicleLabel} är inte i trafik`
														}
														onClick={() => onTripSelect?.(trip.trip_id)}
														onKeyDown={(e) => {
															if (e.key === "Enter" && onTripSelect) {
																onTripSelect(trip.trip_id);
															}
														}}
														style={!isActive ? { cursor: "auto" } : {}}
														aria-label={`Visa avgång mot ${trip?.stop_headsign} som avgår ${updatedTime || scheduledTime}`}
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
					<p className="text-muted-foreground dark text-center">
						Inga fler avgångar inom 6 timmar
					</p>
				)}
			</div>
		</div>
	);
};
