import type { IDbData } from "@shared/models/IDbData";
import { MapPinned } from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { IVehiclePosition } from "@/shared/models/IVehiclePosition";
import { arrow, chevronsCollapse, chevronsExpand } from "../../../public/icons";
import colors from "../colors";
import { useDataContext } from "../context/DataContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useOverflow } from "../hooks/useOverflow";
import { convertGTFSTimeToDate } from "../utilities/convertGTFSTimeToDate";
import { getClosest } from "../utilities/getClosest";
import {
	gtfsRouteModeShortLabelSv,
	gtfsRouteVehicleLabelSv,
} from "../utilities/gtfsRouteTypeLabel";
import { normalizeTimeForDisplay } from "../utilities/normalizeTime";
import {
	filterStopBoardByLines,
	toggleStopBoardLine,
} from "../utilities/stopBoardLineFilter";
import { hasDisplayablePlatformCode } from "../utilities/stopBoardStopResolution";
import { Button } from "./Button";
import { CurrentTripsLoader } from "./CurrentTripsLoader";
import { Icon } from "./Icon";
import { PanelCloseButton } from "./PanelCloseButton";

interface ICurrentTripsProps {
	onTripSelect?: (tripId: string, boardRow?: IDbData) => void;
	onClose?: () => void;
	mapRef?: React.MutableRefObject<google.maps.Map | null>;
	closestStop?: IDbData;
	followedTripId?: string | null;
}

function tripIdsSignature(arr: IDbData[]): string {
	return arr
		.map((t) => `${t.trip_id}:${t.stop_id}:${t.stop_sequence}`)
		.join("|");
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
				s.trip_id === tripId && stopIdMatchesBoardRow(s.stop_id, board.stop_id),
		);
		if (byStopId != null) return byStopId.stop_sequence;
		const byName = rows.find(
			(s) =>
				s.trip_id === tripId && s.stop_name.trim() === board.stop_name.trim(),
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
				s.trip_id === tripId && s.stop_name.trim() === board.stop_name.trim(),
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
	onClose,
	mapRef,
	closestStop,
	followedTripId = null,
}: ICurrentTripsProps) => {
	const { containerRef, isOverflowing, checkOverflow, isScrolledToBottom } =
		useOverflow();
	const isMobile = useIsMobile();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const showOverflowChrome = !isMobile || !isCollapsed;
	const {
		filteredVehicles,
		tripData,
		filteredTripUpdates,
		userPosition,
		isLoading,
		selectedStopForSchedule,
		selectedStopRouteLines,
		stopBoardData,
		selectedStopLineFilter,
		setSelectedStopLineFilter,
		selectedStopPlatformFilter,
		setSelectedStopPlatformFilter,
		selectedStopModeFilter,
		setSelectedStopModeFilter,
		activeFollowedTripId,
		activeVehicleBoardStop,
	} = useDataContext();
	const effectiveFollowedTripId =
		activeFollowedTripId ?? followedTripId ?? null;
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
	const isPinnedStopMode = selectedStopForSchedule !== null;
	const showCurrentTripsLoader =
		!hasFilteredOnce ||
		(isPinnedStopMode
			? stopBoardData.isLoading && stopBoardData.departures.length === 0
			: isLoading);
	/** Närmaste hållplats från GPS (för etikett/knapp — fångas i const så TS kan smalna i handlers). */
	const userNearestStop = userPosition?.closestStop ?? null;
	/** Hållplats för tabellens avgångar (vald eller användarens närmaste — inte bussens läge). */
	const listBoardStop = closestStop ?? userNearestStop;
	/** Fordonets bräddhållplats för injektion/sekvens när tur följs (utan pin-läge). */
	const injectBoardStop =
		!isPinnedStopMode && activeVehicleBoardStop
			? activeVehicleBoardStop
			: listBoardStop;
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

	const activeVehiclePositions = useMemo(
		() =>
			isPinnedStopMode
				? new Set(
						filteredStopBoard.vehicles
							.map((vehicle) => vehicle.trip?.tripId)
							.filter((tripId): tripId is string => Boolean(tripId)),
					)
				: new Set(
						filteredVehicles.data.map(
							(bus: IVehiclePosition) => bus.trip.tripId,
						),
					),
		[filteredStopBoard.vehicles, filteredVehicles.data, isPinnedStopMode],
	);
	const departureTripUpdates = isPinnedStopMode
		? stopBoardData.tripUpdates
		: filteredTripUpdates;
	const departureVehicles = isPinnedStopMode
		? filteredStopBoard.vehicles
		: filteredVehicles.data;

	const getUpdatedDepartureTime = useCallback(
		(tripId: string, stop: IDbData | null | undefined): string | undefined => {
			if (!stop?.stop_id) return undefined;
			if (!departureTripUpdates.length) return undefined;

			const tripUpdate = departureTripUpdates.find(
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
		[departureTripUpdates],
	);

	const getDepartureInstantForFilter = useCallback(
		(trip: IDbData, boardRef: IDbData): Date => {
			if (!departureTripUpdates.length) {
				return convertGTFSTimeToDate(trip.departure_time);
			}
			const tripUpdate = departureTripUpdates.find(
				(t) => t.trip.tripId === trip.trip_id,
			);
			const su = tripUpdate?.stopTimeUpdate;
			if (!su?.length) {
				return convertGTFSTimeToDate(trip.departure_time);
			}
			const byTripStop = trip.stop_id
				? su.find((s) => s.stopId === trip.stop_id && s.departure?.time != null)
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
		[departureTripUpdates],
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
			if (listBoardStop) {
				const boardStop = listBoardStop;
				const stopNameNorm = boardStop.stop_name.trim();
				const boardStopSequenceForFollowed =
					effectiveFollowedTripId && injectBoardStop
						? resolveBoardStopSequenceForTripAtBoard(
								effectiveFollowedTripId,
								injectBoardStop,
								tripData.currentTrips,
								tripData.upcomingTrips,
							)
						: undefined;

				/** RT-försening: följd tur vid bräda får ligga kvar längre efter "passerad" tid. */
				const FOLLOWED_MAX_PAST_MIN = 20;

				function rowPassesDepartureTimeRule(trip: IDbData): boolean {
					try {
						const departureTime = getDepartureInstantForFilter(trip, boardStop);
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
								const veh = departureVehicles.find(
									(v: IVehiclePosition) => v.trip?.tripId === trip.trip_id,
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
									stopIdMatchesBoardRow(trip.stop_id, vehicleBoard.stop_id) ||
									trip.stop_sequence === vehicleBoard.stop_sequence ||
									stopIdMatchesBoardRow(trip.stop_id, boardStop.stop_id) ||
									(boardStopSequenceForFollowed != null &&
										trip.stop_sequence === boardStopSequenceForFollowed);
							} else {
								atCurrentBoardStop =
									stopIdMatchesBoardRow(trip.stop_id, boardStop.stop_id) ||
									(boardStopSequenceForFollowed != null &&
										trip.stop_sequence === boardStopSequenceForFollowed);
							}

							if (minutesSince <= 0) return true;

							const keep =
								atCurrentBoardStop && minutesSince <= FOLLOWED_MAX_PAST_MIN;
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

				if (isPinnedStopMode) {
					newList = filteredStopBoard.departures.filter(
						rowPassesDepartureTimeRule,
					);
				} else {
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

					if (effectiveFollowedTripId && injectBoardStop) {
						const injected = injectFollowedTripRowAtBoard(
							effectiveFollowedTripId,
							injectBoardStop,
							boardStopSequenceForFollowed,
							tripData.currentTrips,
							tripData.upcomingTrips,
						);

						if (injected) {
							newList = [
								injected,
								...newList.filter((t) => t.trip_id !== effectiveFollowedTripId),
							];
						}
					}
					newList = newList.filter(rowPassesDepartureTimeRule);
				}

				newList = [...newList].sort((a, b) => {
					const ta = getDepartureInstantForFilter(
						a,
						isPinnedStopMode ? a : boardStop,
					).getTime();
					const tb = getDepartureInstantForFilter(
						b,
						isPinnedStopMode ? b : boardStop,
					).getTime();
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
		listBoardStop,
		injectBoardStop,
		isPinnedStopMode,
		filteredStopBoard.departures,
		tripData.upcomingTrips,
		tripData.currentTrips,
		getDepartureInstantForFilter,
		effectiveFollowedTripId,
		activeVehicleBoardStop,
		departureVehicles,
	]);

	let nextBus: IDbData | undefined;
	let rest: IDbData[] = [];

	if (displayTrips.length > 0) {
		[nextBus, ...rest] = displayTrips;
	}

	const nextBusUpdatedTime = nextBus
		? getUpdatedDepartureTime(
				nextBus.trip_id,
				isPinnedStopMode ? nextBus : listBoardStop,
			)
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
	const boardModes = [
		...new Set(
			stopBoardData.departures
				.map((departure) => departure.route_type)
				.filter((routeType): routeType is number => routeType != null),
		),
	].sort((a, b) =>
		gtfsRouteModeShortLabelSv(a).localeCompare(
			gtfsRouteModeShortLabelSv(b),
			"sv",
		),
	);
	const departuresInSelectedMode = stopBoardData.departures.filter(
		(departure) =>
			selectedStopModeFilter === null ||
			departure.route_type === selectedStopModeFilter,
	);
	const servedPlatformIds = new Set(
		departuresInSelectedMode.map((departure) => departure.stop_id),
	);
	const boardPlatforms = stopBoardData.children
		.filter(
			(child) =>
				child.location_type === 0 &&
				servedPlatformIds.has(child.stop_id) &&
				hasDisplayablePlatformCode(child.platform_code),
		)
		.sort((a, b) =>
			(a.platform_code || a.stop_name).localeCompare(
				b.platform_code || b.stop_name,
				"sv",
				{ numeric: true },
			),
		);
	const boardRoutes = [
		...new Set(
			departuresInSelectedMode
				.filter(
					(departure) =>
						selectedStopPlatformFilter === null ||
						departure.stop_id === selectedStopPlatformFilter,
				)
				.map((departure) => departure.route_short_name)
				.filter(Boolean),
		),
	].sort((a, b) => a.localeCompare(b, "sv", { numeric: true }));
	const boardPlatformCode = hasDisplayablePlatformCode(
		listBoardStop?.platform_code,
	)
		? listBoardStop?.platform_code?.trim()
		: null;

	useEffect(() => {
		if (
			selectedStopPlatformFilter !== null &&
			!boardPlatforms.some(
				(platform) => platform.stop_id === selectedStopPlatformFilter,
			)
		) {
			setSelectedStopPlatformFilter(null);
		}
	}, [
		boardPlatforms,
		selectedStopPlatformFilter,
		setSelectedStopPlatformFilter,
	]);

	useEffect(() => {
		if (
			selectedStopLineFilter !== null &&
			!selectedStopLineFilter.some((line) =>
				boardRoutes.some((route) => route.toUpperCase() === line.toUpperCase()),
			)
		) {
			setSelectedStopLineFilter(null);
		}
	}, [boardRoutes, selectedStopLineFilter, setSelectedStopLineFilter]);

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
		if (showCurrentTripsLoader) return;
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
		showCurrentTripsLoader,
		hasTripsToDisplay,
		displayTrips.length,
		tripData.upcomingTrips.length,
		listBoardStop?.stop_id,
		selectedStopRouteLines?.join("|") ?? "",
		isCollapsed,
		isMobile,
	]);

	useEffect(() => {
		if (isCollapsed && isMobile) {
			containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
		}
	}, [isCollapsed, isMobile, containerRef]);

	const collapseToggle = (
		<div className="current-trips__collapse-toggle">
			<Button
				title={isCollapsed ? "Expandera vy" : "Minska vy"}
				className="--collapsible"
				path={!isCollapsed ? chevronsCollapse.path : chevronsExpand.path}
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
	);

	if (showCurrentTripsLoader) {
		return (
			<div className="current-trips">
				{onClose ? <PanelCloseButton onClose={onClose} /> : null}
				<div
					className={`table-container ${isCollapsed && isMobile ? "--collapsed" : ""}`}
				>
					<CurrentTripsLoader />
				</div>
				{collapseToggle}
			</div>
		);
	}

	return (
		<div className="current-trips">
			{onClose ? <PanelCloseButton onClose={onClose} /> : null}
			<div
				className={`table-container ${isOverflowing && showOverflowChrome ? "--overflowing" : ""} ${isScrolledToBottom && showOverflowChrome ? "--at-bottom" : ""} ${isCollapsed && isMobile ? "--collapsed" : ""}`}
				aria-live="polite"
				ref={containerRef}
				onScroll={checkOverflow}
			>
				<div className="trips-header">
					<h2 className="text-left text-2xl font-extrabold tracking-tight text-balance">
						{isPinnedStopMode && listBoardStop
							? `${listBoardStop.stop_name}${boardPlatformCode ? `, läge ${boardPlatformCode}` : ""}`
							: "Avgångar närmast dig"}
					</h2>
					{isPinnedStopMode ? (
						<p className="text-sm text-muted-foreground dark">
							{selectedStopModeFilter === null &&
							selectedStopPlatformFilter === null &&
							selectedStopLineFilter === null
								? "Avgångar för alla trafikslag och lägen"
								: "Avgångar för valda filter"}
						</p>
					) : null}
					{isPinnedStopMode && boardModes.length > 1 ? (
						<section
							className="current-trips__filter-overview"
							aria-label="Filtrera trafikslag"
						>
							<span className="current-trips__filter-label">Trafikslag</span>
							<button
								type="button"
								aria-pressed={selectedStopModeFilter === null}
								className={`current-trips__line-filter${selectedStopModeFilter === null ? " current-trips__line-filter--active" : ""}`}
								onClick={() => {
									setSelectedStopModeFilter(null);
									setSelectedStopPlatformFilter(null);
									setSelectedStopLineFilter(null);
								}}
							>
								Alla
							</button>
							{boardModes.map((routeType) => (
								<button
									key={routeType}
									type="button"
									aria-pressed={selectedStopModeFilter === routeType}
									className={`current-trips__line-filter${selectedStopModeFilter === routeType ? " current-trips__line-filter--active" : ""}`}
									onClick={() => {
										setSelectedStopModeFilter(
											selectedStopModeFilter === routeType ? null : routeType,
										);
										setSelectedStopPlatformFilter(null);
										setSelectedStopLineFilter(null);
									}}
								>
									{gtfsRouteModeShortLabelSv(routeType)}
								</button>
							))}
						</section>
					) : null}
					{isPinnedStopMode && boardPlatforms.length > 1 ? (
						<section
							className="current-trips__filter-overview"
							aria-label="Filtrera läge"
						>
							<span className="current-trips__filter-label">Läge</span>
							<button
								type="button"
								aria-pressed={selectedStopPlatformFilter === null}
								className={`current-trips__line-filter${selectedStopPlatformFilter === null ? " current-trips__line-filter--active" : ""}`}
								onClick={() => {
									setSelectedStopPlatformFilter(null);
									setSelectedStopLineFilter(null);
								}}
							>
								Alla
							</button>
							{boardPlatforms.map((platform) => (
								<button
									key={platform.stop_id}
									type="button"
									aria-pressed={selectedStopPlatformFilter === platform.stop_id}
									className={`current-trips__line-filter${selectedStopPlatformFilter === platform.stop_id ? " current-trips__line-filter--active" : ""}`}
									onClick={() => {
										setSelectedStopPlatformFilter(
											selectedStopPlatformFilter === platform.stop_id
												? null
												: platform.stop_id,
										);
										setSelectedStopLineFilter(null);
									}}
								>
									{platform.platform_code}
								</button>
							))}
						</section>
					) : null}
					{isPinnedStopMode && boardRoutes.length > 0 ? (
						<section
							className="current-trips__filter-overview"
							aria-label="Filtrera linjer vid hållplatsen"
						>
							<span className="current-trips__filter-label">Linje</span>
							<button
								type="button"
								aria-pressed={selectedStopLineFilter === null}
								className={`current-trips__line-filter${selectedStopLineFilter === null ? " current-trips__line-filter--active" : ""}`}
								onClick={() => setSelectedStopLineFilter(null)}
							>
								Alla
							</button>
							{boardRoutes.map((name) => (
								<button
									key={name}
									type="button"
									aria-pressed={
										selectedStopLineFilter?.includes(name.toUpperCase()) ??
										false
									}
									className={`current-trips__line-filter${selectedStopLineFilter?.includes(name.toUpperCase()) ? " current-trips__line-filter--active" : ""}`}
									onClick={() =>
										setSelectedStopLineFilter((current) =>
											toggleStopBoardLine(current, name, boardRoutes),
										)
									}
								>
									{name}
								</button>
							))}
						</section>
					) : null}
					{!isPinnedStopMode ? (
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
					) : null}
					{!isPinnedStopMode && routeMeta?.route_long_name ? (
						<p className="route-long-name text-sm text-muted-foreground dark">
							{routeMeta.route_long_name}
						</p>
					) : null}
					{userNearestStop && !isPinnedStopMode && (
						<p className="station-name">
							<span className="text-muted-foreground dark">
								Din närmaste hållplats:{" "}
							</span>
							<button
								type="button"
								onClick={() => {
									handleOnStopClick(userNearestStop);
								}}
							>
								<strong>{userNearestStop.stop_name}</strong>
							</button>
						</p>
					)}
				</div>
				{hasTripsToDisplay ? (
					<>
						<button
							type="button"
							title={
								isActive ? "Visa position" : "Visa hållplatser längs linjen"
							}
							aria-label={`Visa nästa avgång mot ${nextBus?.stop_headsign} som avgår ${nextBusUpdatedTime || nextBusScheduledTime}`}
							className={`next-departure ${isActive ? " --active" : ""}`}
							onClick={() => {
								nextBus ? onTripSelect?.(nextBus.trip_id, nextBus) : null;
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && onTripSelect && nextBus) {
									onTripSelect(nextBus.trip_id, nextBus);
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
							{isPinnedStopMode ? (
								<p className="current-trips__departure-meta">
									<span className="current-trips__line-badge">
										{nextBus?.route_short_name}
									</span>
									{boardPlatforms.length > 1 &&
									hasDisplayablePlatformCode(nextBus?.platform_code) ? (
										<span className="current-trips__platform-label">
											Läge {nextBus?.platform_code}
										</span>
									) : null}
								</p>
							) : null}
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
								{(isActive || nextBus?.trip_id === effectiveFollowedTripId) && (
									<span className="inline-block -translate-y-[1px] translate-x-[6px]">
										<MapPinned className="w-6 h-6" />
									</span>
								)}
							</p>
						</button>
						{rest.length > 0 ? (
							<table className="current-trips__departures-table">
								<colgroup>
									<col className="current-trips__status-column" />
									{isPinnedStopMode ? (
										<col className="current-trips__line-column" />
									) : null}
									<col className="current-trips__destination-column" />
									<col className="current-trips__time-column" />
								</colgroup>
								<thead className="px-2">
									<tr key="th-row">
										<th />
										{isPinnedStopMode ? <th>Linje</th> : null}
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
											isPinnedStopMode ? trip : listBoardStop,
										);
										const scheduledTime = normalizeTimeForDisplay(
											trip?.departure_time?.slice(0, 5),
										);
										const hasUpdate =
											updatedTime && updatedTime !== scheduledTime;
										const isActive = activeVehiclePositions.has(trip.trip_id);

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
												{isPinnedStopMode ? (
													<td>
														<span className="current-trips__line-badge">
															{trip.route_short_name}
														</span>
														{boardPlatforms.length > 1 &&
														hasDisplayablePlatformCode(trip.platform_code) ? (
															<span className="current-trips__platform-label">
																Läge {trip.platform_code}
															</span>
														) : null}
													</td>
												) : null}
												<td key={trip.trip_id} className="align-middle">
													<button
														type="button"
														className="row-button"
														title={
															isActive
																? "Visa position"
																: "Visa hållplatser längs linjen"
														}
														onClick={() => onTripSelect?.(trip.trip_id, trip)}
														onKeyDown={(e) => {
															if (e.key === "Enter" && onTripSelect) {
																onTripSelect(trip.trip_id, trip);
															}
														}}
														aria-label={`Visa avgång mot ${trip?.stop_headsign} som avgår ${updatedTime || scheduledTime}`}
													>
														{trip?.stop_headsign}{" "}
														{(isActive ||
															trip.trip_id === effectiveFollowedTripId) && (
															<span className="inline-block -translate-y-[1px] translate-x-[6px]">
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
								Inga fler avgångar inom 12 timmar
							</p>
						)}
					</>
				) : (
					<p className="text-muted-foreground dark text-center">
						{isPinnedStopMode && stopBoardData.error
							? "Kunde inte hämta avgångar"
							: isPinnedStopMode &&
									(selectedStopLineFilter !== null ||
										selectedStopPlatformFilter !== null ||
										selectedStopModeFilter !== null)
								? "Inga kommande avgångar för valda filter"
								: "Inga fler avgångar inom 12 timmar"}
					</p>
				)}
			</div>
			{collapseToggle}
		</div>
	);
};
