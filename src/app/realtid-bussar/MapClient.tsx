"use client";

import type { IDbData } from "@shared/models/IDbData";
import type { IShapes } from "@shared/models/IShapes";
import { getOperatorMapView } from "@shared/config/gtfsOperators";
import {
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	APIProvider,
	ControlPosition,
	Map as GoogleMap,
	type MapCameraChangedEvent,
	MapControl,
	type MapEvent,
	type MapMouseEvent,
	RenderingType,
} from "@vis.gl/react-google-maps";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	startTransition,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CurrentTrips } from "../components/CurrentTrips";
import { MapControlButtons } from "../components/MapControlButtons";
import RouteShapePolyline from "../components/RouteShapePolyline";
import UserMessage from "../components/UserMessage";
import VehicleMarkers from "../components/VehicleMarkers";
import { useDataContext } from "../context/DataContext";
import { useIsMobile } from "../hooks/useIsMobile";
import {
	parseOperatorFromRealtimePathname,
	searchPathForOperator,
} from "../paths";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";
import { MapStopPreview } from "./MapStopPreview";
import { StopMarkersLayer } from "./StopMarkersLayer";
import {
	expandStopQueryBounds,
	filterStopsInViewport,
	type IStopPositionJson,
	STOP_MARKERS_COMPACT_ZOOM,
	STOP_MARKERS_DETAIL_ZOOM,
	type StopsPositionsFile,
	snapStopQueryBounds,
} from "./stopPositionsTypes";

/**
 * All map camera-driven React state (stops viewport, zoom thresholds, preview) updates via this debounce
 * so we do not re-render the full map subtree on every Maps camera frame.
 */
const MAP_VIEWPORT_DEBOUNCE_MS = 320;
/** Extra marginal runt kartans synliga ruta innan hållplatser hämtas (mindre payload än hela stops-positions.json). */
const MAP_STOPS_BOUNDS_EXPAND_RATIO = 0.4;
/**
 * Efter viewport-debounce kan bounds ändras i snabb följd; utan detta avbryts fetch (AbortError)
 * innan servern hunnit svara. Vänta tills rutan legat still innan /api/stops/positions.
 */
const MAP_STOPS_POSITIONS_FETCH_DEBOUNCE_MS = 450;

/** Utzoomad start när ingen linje är vald — efter första idle zoomar vi in (löser sporadiska svarta rutor / att lager inte hinner med förrän man zoomar manuellt). */
const MAP_BOOTSTRAP_ZOOM = 11;
const MAP_TARGET_INITIAL_ZOOM = 14;
/** Minsta tid efter första `tilesloaded` innan spinner får släckas (workers hinner starta). */
const MAP_VECTOR_PAINT_POST_TILES_MIN_MS = 1400;
/** Därtill: inget nytt `idle` på minst denna ruta (sista vektorbatchen). */
const MAP_VECTOR_PAINT_IDLE_DEBOUNCE_MS = 560;

/**
 * Överlever unmount när man lämnar kartrouten (samma flik) så vi inte zoomar ut/in igen vid SPA-tillbaknavigation.
 * Nollställs vid full sidladdning.
 */
let mapBootstrapZoomDoneInTab = false;

/** Max en full sidomladdning per “fastnad”-episod; nollställs när kartan blivit klar. */
const MAP_BOOT_HARD_RELOAD_COUNT_KEY = "mapBootHardReloadCount";

/** På mobil kan kartans click köas före markör/knapp — då rensas preview innan linjeval. Ignorera klick som kommer från vårt hållplats-UI. */
function isClickFromStopUi(e: MapMouseEvent): boolean {
	const raw = e.domEvent?.target;
	if (!raw || !(raw instanceof Element)) return false;
	return Boolean(
		raw.closest(".map-stop-preview") ||
			raw.closest("[data-stop-marker]") ||
			raw.closest(".stop-marker-visibility-wrap"),
	);
}

type ShapeGroup = { shape_id: string; points: IShapes[] };

const LINE_SHAPE_FIT_PADDING = 56;
const LINE_SHAPE_FIT_MAX_ZOOM = 16;

function isPointInBounds(
	lat: number,
	lng: number,
	bounds: { north: number; south: number; east: number; west: number },
): boolean {
	return (
		lat <= bounds.north &&
		lat >= bounds.south &&
		lng <= bounds.east &&
		lng >= bounds.west
	);
}

function extendBoundsWithPoints(
	bounds: google.maps.LatLngBounds,
	points: IShapes[] | undefined,
): void {
	if (!points || points.length < 2) return;
	for (const p of points) {
		bounds.extend({ lat: p.shape_pt_lat, lng: p.shape_pt_lon });
	}
}

function boundsFromLineOrRouteShapes(
	lineShapes: ShapeGroup[],
	routeShapesFallback: ShapeGroup[],
): google.maps.LatLngBounds | null {
	const bounds = new google.maps.LatLngBounds();
	for (const ls of lineShapes) {
		extendBoundsWithPoints(bounds, ls.points);
	}
	if (bounds.isEmpty()) {
		for (const s of routeShapesFallback) {
			extendBoundsWithPoints(bounds, s.points);
		}
	}
	return bounds.isEmpty() ? null : bounds;
}

export default function MapClient() {
	const {
		filteredVehicles,
		tripData,
		userPosition,
		setUserPosition,
		setIsCurrentTripsOpen,
		mapStopPreview,
		setMapStopPreview,
		selectedStopForSchedule,
		setSelectedStopForSchedule,
		setSelectedStopRouteLines,
		activeVehicleBoardStop,
	} = useDataContext();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const mapRef = useRef<google.maps.Map | null>(null);
	const [clickedOutside, setClickedOutside] = useState(false);
	const [zoomWindowLevel, setCurrentWindowZoomLevel] = useState(100);
	const [showCurrentTrips, setShowCurrentTrips] = useState(false);
	const [infoWindowActive, setInfoWindowActive] = useState(false);
	const [followBus, setFollowBus] = useState(false);
	const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
	const [myPositionErrorMessage, setMyPositionErrorMessage] = useState<
		string | null
	>(null);
	const followedTripId = useMemo(() => {
		if (!activeMarkerId) return null;
		return (
			filteredVehicles.data.find((v) => v.vehicle.id === activeMarkerId)?.trip
				?.tripId ?? null
		);
	}, [activeMarkerId, filteredVehicles.data]);
	/** Stabil avsedd så zoom/pan inte invaliderar useMemo när fordonslistan är oförändrad. */
	const vehicleSig = useMemo(
		() =>
			filteredVehicles.data
				.map(
					(v) =>
						`${v.trip?.tripId ?? ""}:${v.position.latitude.toFixed(4)}:${v.position.longitude.toFixed(4)}`,
				)
				.sort()
				.join("|"),
		[filteredVehicles.data],
	);
	const fallbackFollowed = useMemo(() => {
		const baseStop =
			selectedStopForSchedule ?? userPosition?.closestStop ?? null;
		if (!baseStop || filteredVehicles.data.length === 0) {
			return { tripId: null as string | null };
		}
		const matchingRows = tripData.currentTrips.filter(
			(row) =>
				row.stop_id === baseStop.stop_id ||
				row.stop_name.trim() === baseStop.stop_name.trim(),
		);
		let candidateTripId =
			matchingRows.find((row) =>
				filteredVehicles.data.some((v) => v.trip.tripId === row.trip_id),
			)?.trip_id ?? null;
		if (!candidateTripId) {
			candidateTripId =
				tripData.upcomingTrips.find((row) =>
					filteredVehicles.data.some((v) => v.trip.tripId === row.trip_id),
				)?.trip_id ?? null;
		}
		if (!candidateTripId) {
			return { tripId: null as string | null };
		}
		return { tripId: candidateTripId };
	}, [
		selectedStopForSchedule?.stop_id,
		selectedStopForSchedule?.stop_name,
		userPosition?.closestStop?.stop_id,
		userPosition?.closestStop?.stop_name,
		vehicleSig,
		tripData.currentTrips,
		tripData.upcomingTrips,
	]);
	const [mapReady, setMapReady] = useState(false);
	const [mapMountKey, setMapMountKey] = useState(0);
	const [mapViewport, setMapViewport] = useState<{
		zoom: number;
		bounds: google.maps.LatLngBoundsLiteral;
	} | null>(null);
	const [allStopPositions, setAllStopPositions] = useState<
		IStopPositionJson[] | null
	>(null);
	const isMobile = useIsMobile();
	const zoomRef = useRef<number>(8);
	const mapViewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const [hideUserPositionForZoom, setHideUserPositionForZoom] = useState(false);
	const hideUserPositionTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const stopPreviewFetchGenRef = useRef(0);
	const mapStopPanRequestIdRef = useRef<string | null>(null);
	const lastLineShapeFitKeyRef = useRef<string>("");
	/** `linje` som fanns i dokumentets URL vid MapClient första mount (klient). */
	const initialLinjeFromDocumentRef = useRef<string | null>(null);
	/** Efter första rutt-zoom (mapfit, initial URL-linje eller båda). */
	const hasDoneInitialDocumentLinjeFitRef = useRef(false);
	/** defaultCenter gäller bara vid mount; geolokering kommer ofta senare — pan en gång när position finns (utan linje i URL). */
	const userGeolocatePanDoneRef = useRef(false);
	const prevLinjeParamForUserPanRef = useRef("");
	const mapInitialZoomBootstrapDoneRef = useRef(false);
	const prevMapOperatorForPanRef = useRef<string | null>(null);
	const mapBootRecoveryAttemptsRef = useRef(0);
	const vectorPaintIdleListenerRef =
		useRef<google.maps.MapsEventListener | null>(null);
	const vectorPaintDebounceTimerRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	/** Först efter `tilesloaded` får debouncad `idle` släcka spinnern — ren `idle` kommer före vectortown-workers. */
	const vectorTilesLoadedGateRef = useRef(false);
	/** Epoch ms vid första `tilesloaded` (för minsta tid innan spinner får släckas). */
	const vectorFirstTilesLoadedAtRef = useRef<number | null>(null);

	const clearVectorPaintIdleWatchers = useCallback(() => {
		vectorTilesLoadedGateRef.current = false;
		vectorFirstTilesLoadedAtRef.current = null;
		if (vectorPaintDebounceTimerRef.current) {
			clearTimeout(vectorPaintDebounceTimerRef.current);
			vectorPaintDebounceTimerRef.current = null;
		}
		if (
			vectorPaintIdleListenerRef.current &&
			typeof google !== "undefined"
		) {
			google.maps.event.removeListener(vectorPaintIdleListenerRef.current);
			vectorPaintIdleListenerRef.current = null;
		}
	}, []);

	const linjeParam = searchParams.get("linje")?.trim().toUpperCase() ?? "";
	const operatorUrlParam = searchParams.get("operator")?.trim() ?? "";
	const mapFitParam = searchParams.get("mapfit") === "1";
	const focusUserParam = searchParams.get("focusUser") === "1";

	const operatorSlugFromPath = useMemo(
		() => parseOperatorFromRealtimePathname(pathname),
		[pathname],
	);

	const [operatorsMeta, setOperatorsMeta] = useState<{
		operators: string[];
		defaultOperator: string;
	} | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const m = (await fetch("/api/operators").then((r) =>
					r.json(),
				)) as {
					operators: string[];
					defaultOperator: string;
				};
				if (!cancelled) setOperatorsMeta(m);
			} catch {
				if (!cancelled) {
					setOperatorsMeta({ operators: ["sl"], defaultOperator: "sl" });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	/** Samma semantik som SearchBar:s effectiveOperator, så karta och API-val hänger ihop. */
	const mapOperatorForView = useMemo(() => {
		const pathSlug = operatorSlugFromPath ?? "";
		const querySlug = operatorUrlParam.trim().toLowerCase();
		if (!operatorsMeta) {
			if (pathSlug) return pathSlug;
			if (querySlug) return querySlug;
			return "sl";
		}
		if (pathSlug && operatorsMeta.operators.includes(pathSlug)) {
			return pathSlug;
		}
		if (querySlug && operatorsMeta.operators.includes(querySlug)) {
			return querySlug;
		}
		return operatorsMeta.defaultOperator;
	}, [operatorsMeta, operatorUrlParam, operatorSlugFromPath]);

	const operatorMapView = useMemo(
		() => getOperatorMapView(mapOperatorForView),
		[mapOperatorForView],
	);

	const findOperatorForPosition = useCallback(
		(lat: number, lng: number): string | null => {
			const operators = operatorsMeta?.operators ?? [mapOperatorForView];
			const matchingOperators = operators.filter((op) => {
				const view = getOperatorMapView(op);
				return isPointInBounds(lat, lng, view.restriction);
			});
			if (matchingOperators.length === 0) {
				return null;
			}
			if (matchingOperators.length === 1) {
				return matchingOperators[0];
			}

			// Bounds can overlap between operators. Pick the region whose
			// default center is closest to the user position.
			let best = matchingOperators[0];
			let bestDistance = Number.POSITIVE_INFINITY;
			for (const op of matchingOperators) {
				const { defaultCenter } = getOperatorMapView(op);
				const dLat = defaultCenter.lat - lat;
				const dLng = defaultCenter.lng - lng;
				const distanceSq = dLat * dLat + dLng * dLng;
				if (distanceSq < bestDistance) {
					bestDistance = distanceSq;
					best = op;
				}
			}
			return best;
		},
		[operatorsMeta?.operators, mapOperatorForView],
	);

	const searchHrefWithLinje = useCallback(
		(linje: string) => {
			const p = new URLSearchParams();
			p.set("linje", linje);
			return `${searchPathForOperator(mapOperatorForView)}?${p.toString()}`;
		},
		[mapOperatorForView],
	);

	if (
		typeof window !== "undefined" &&
		initialLinjeFromDocumentRef.current === null
	) {
		initialLinjeFromDocumentRef.current =
			new URLSearchParams(window.location.search)
				.get("linje")
				?.trim()
				.toUpperCase() ?? "";
	}

	const defaultMapCenter = useMemo(
		() =>
			userPosition
				? { lat: userPosition.lat, lng: userPosition.lng }
				: operatorMapView.defaultCenter,
		[userPosition, operatorMapView.defaultCenter],
	);

	useEffect(() => {
		if (!mapReady || !mapRef.current) return;
		if (prevMapOperatorForPanRef.current === null) {
			prevMapOperatorForPanRef.current = mapOperatorForView;
			const initialMap = mapRef.current;
			initialMap.panTo(operatorMapView.defaultCenter);
			initialMap.setZoom(MAP_TARGET_INITIAL_ZOOM);
			// Regionbyte ska vinna över geolokaliseringens engångspan.
			userGeolocatePanDoneRef.current = true;
			return;
		}
		if (prevMapOperatorForPanRef.current === mapOperatorForView) return;
		prevMapOperatorForPanRef.current = mapOperatorForView;
		const map = mapRef.current;
		map.panTo(operatorMapView.defaultCenter);
		map.setZoom(MAP_TARGET_INITIAL_ZOOM);
		// Regionbyte ska vinna över geolokaliseringens engångspan.
		userGeolocatePanDoneRef.current = true;
	}, [
		mapReady,
		mapOperatorForView,
		operatorMapView.defaultCenter,
	]);

	useEffect(() => {
		lastLineShapeFitKeyRef.current = "";
	}, [linjeParam]);

	useEffect(() => {
		prevLinjeParamForUserPanRef.current = linjeParam;
	}, [linjeParam]);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !userPosition) return;
		if (linjeParam) return;
		if (userGeolocatePanDoneRef.current) return;
		userGeolocatePanDoneRef.current = true;
		mapRef.current.panTo({
			lat: userPosition.lat,
			lng: userPosition.lng,
		});
	}, [mapReady, userPosition, linjeParam]);

	useEffect(() => {
		if (!focusUserParam || !mapReady || !mapRef.current || !userPosition) return;
		const map = mapRef.current;
		map.panTo({
			lat: userPosition.lat,
			lng: userPosition.lng,
		});
		if ((map.getZoom() ?? 10) < 14) {
			map.setZoom(14);
		}
		const p = new URLSearchParams(searchParams.toString());
		p.delete("focusUser");
		const qs = p.toString();
		const base = searchPathForOperator(mapOperatorForView);
		router.replace(qs ? `${base}?${qs}` : base);
	}, [
		focusUserParam,
		mapReady,
		userPosition,
		searchParams,
		mapOperatorForView,
		router,
	]);

	useEffect(() => {
		if (!mapReady || !mapRef.current || linjeParam) return;
		if (mapInitialZoomBootstrapDoneRef.current) return;
		const map = mapRef.current;
		const listener = google.maps.event.addListenerOnce(map, "idle", () => {
			mapInitialZoomBootstrapDoneRef.current = true;
			google.maps.event.trigger(map, "resize");
			if (!mapBootstrapZoomDoneInTab) {
				const z = map.getZoom();
				if (z != null && z <= MAP_BOOTSTRAP_ZOOM) {
					map.setZoom(MAP_TARGET_INITIAL_ZOOM);
				}
				mapBootstrapZoomDoneInTab = true;
			}
		});
		return () => {
			google.maps.event.removeListener(listener);
		};
	}, [mapReady, linjeParam]);

	useEffect(() => {
		clearVectorPaintIdleWatchers();
		mapBootRecoveryAttemptsRef.current = 0;
		setMapReady(false);
		mapRef.current = null;
		setMapViewport(null);
	}, [mapOperatorForView, clearVectorPaintIdleWatchers]);

	useEffect(() => {
		if (mapReady) {
			mapBootRecoveryAttemptsRef.current = 0;
			return;
		}
		if (mapBootRecoveryAttemptsRef.current >= 2) {
			const hardReloads = Number(
				sessionStorage.getItem(MAP_BOOT_HARD_RELOAD_COUNT_KEY) ?? "0",
			);
			if (hardReloads < 1) {
				sessionStorage.setItem(
					MAP_BOOT_HARD_RELOAD_COUNT_KEY,
					String(hardReloads + 1),
				);
				window.location.reload();
			}
			return;
		}
		const timer = setTimeout(() => {
			if (mapReady || mapBootRecoveryAttemptsRef.current >= 2) {
				return;
			}
			mapBootRecoveryAttemptsRef.current += 1;
			clearVectorPaintIdleWatchers();
			mapRef.current = null;
			setMapViewport(null);
			setMapMountKey((prev) => prev + 1);
		}, 9000);

		return () => clearTimeout(timer);
	}, [mapReady, mapMountKey, clearVectorPaintIdleWatchers]);

	useEffect(() => {
		if (mapReady && typeof window !== "undefined") {
			sessionStorage.removeItem(MAP_BOOT_HARD_RELOAD_COUNT_KEY);
		}
	}, [mapReady]);

	useEffect(() => {
		const handleOnline = () => {
			if (mapReady) return;
			setMapMountKey((prev) => prev + 1);
		};
		window.addEventListener("online", handleOnline);
		return () => {
			window.removeEventListener("online", handleOnline);
		};
	}, [mapReady]);

	useEffect(() => {
		const ctaButton = document.getElementById("cta");
		const backgroundImage = document.getElementById("background-image");
		ctaButton?.classList.add("--hidden");
		backgroundImage?.classList.add("--hidden");

		return () => {
			ctaButton?.classList.remove("--hidden");
			backgroundImage?.classList.remove("--hidden");
		};
	}, []);

	useEffect(() => {
		const main = document.getElementById("follow-bus-border");
		if (followBus && filteredVehicles.data.length > 0) {
			main?.classList.add("follow-bus-active");
		} else {
			main?.classList.remove("follow-bus-active");
		}
		return () => {
			main?.classList.remove("follow-bus-active");
		};
	}, [followBus, filteredVehicles.data.length]);

	const getTripsByStopId = useCallback(
		(array: IDbData[]) => {
			const stopId =
				selectedStopForSchedule?.stop_id ?? userPosition?.closestStop?.stop_id;
			if (!stopId) {
				return [];
			}
			return array.filter((item) => item.stop_id === stopId);
		},
		[selectedStopForSchedule?.stop_id, userPosition?.closestStop?.stop_id],
	);

	const handlePreviewLineClick = useCallback(
		(routeShortName: string, stop: IDbData) => {
			const names = mapStopPreview?.routeShortNames;
			setSelectedStopRouteLines(
				names?.length
					? [...names].sort((a, b) => a.localeCompare(b, "sv"))
					: null,
			);
			setSelectedStopForSchedule(stop);
			setMapStopPreview(null);
			router.push(searchHrefWithLinje(routeShortName));
		},
		[
			mapStopPreview,
			router,
			searchHrefWithLinje,
			setMapStopPreview,
			setSelectedStopForSchedule,
			setSelectedStopRouteLines,
		],
	);

	const handleStopMarkerClick = useCallback(
		async (stop: IStopPositionJson) => {
			const gen = ++stopPreviewFetchGenRef.current;
			try {
				const res = await fetch(
					appendOperatorToApiUrl(
						`/api/stops/${encodeURIComponent(stop.id)}/routes`,
						mapOperatorForView,
					),
				);
				if (gen !== stopPreviewFetchGenRef.current) return;
				if (!res.ok) {
					return;
				}
				const data = (await res.json()) as {
					stop_id: string;
					stop_name: string;
					stop_lat: number;
					stop_lon: number;
					feed_version: string;
					routes: string[];
				};
				if (gen !== stopPreviewFetchGenRef.current) return;
				const sortedRoutes = [...data.routes].sort((a, b) =>
					a.localeCompare(b, "sv"),
				);
				const stopDb: IDbData = {
					trip_id: "",
					shape_id: "",
					route_short_name: "",
					stop_headsign: "",
					stop_id: data.stop_id,
					departure_time: "",
					stop_name: data.stop_name,
					stop_sequence: 0,
					stop_lat: data.stop_lat,
					stop_lon: data.stop_lon,
					feed_version: data.feed_version ?? "",
				};
				mapStopPanRequestIdRef.current = data.stop_id;
				setSelectedStopForSchedule(stopDb);
				setSelectedStopRouteLines(sortedRoutes);
				setShowCurrentTrips(true);

				const linje = searchParams.get("linje")?.trim().toUpperCase() ?? "";
				const currentLineServesStop =
					Boolean(linje) && sortedRoutes.some((r) => r.toUpperCase() === linje);
				if (sortedRoutes.length > 0 && !currentLineServesStop) {
					router.push(searchHrefWithLinje(sortedRoutes[0]));
				}
			} catch (e) {
				if (gen !== stopPreviewFetchGenRef.current) return;
				console.error(e);
			}
		},
		[
			router,
			searchParams,
			mapOperatorForView,
			searchHrefWithLinje,
			setSelectedStopForSchedule,
			setSelectedStopRouteLines,
		],
	);

	const viewportForStops = mapViewport;
	const viewportForStopsRef = useRef(viewportForStops);
	viewportForStopsRef.current = viewportForStops;

	const queueMapViewport = useCallback(
		(zoom: number, bounds: google.maps.LatLngBoundsLiteral) => {
			if (mapViewportDebounceRef.current) {
				clearTimeout(mapViewportDebounceRef.current);
				mapViewportDebounceRef.current = null;
			}
			mapViewportDebounceRef.current = setTimeout(() => {
				mapViewportDebounceRef.current = null;
				startTransition(() => {
					setMapViewport({ zoom, bounds });
				});
			}, MAP_VIEWPORT_DEBOUNCE_MS);
		},
		[],
	);

	const visibleStopMarkers = useMemo(
		() =>
			filterStopsInViewport(
				allStopPositions,
				viewportForStops?.zoom ?? 0,
				viewportForStops?.bounds ?? null,
			),
		[allStopPositions, viewportForStops],
	);

	/** Lägre prioritet under kamerarörelse så tusentals markör-DOM inte blockerar huvudtråden på en gång. */
	const stopsForStopLayer = useDeferredValue(visibleStopMarkers);

	/** Samma källa som viewport-filter: undviker att hållplatsmarkörer följer varje kamerasteg i React. */
	const zoomForStopUi = viewportForStops?.zoom ?? 0;
	const stopMarkersVisible = useMemo(
		() =>
			zoomForStopUi >= STOP_MARKERS_COMPACT_ZOOM && !hideUserPositionForZoom,
		[zoomForStopUi, hideUserPositionForZoom],
	);
	const stopMarkersDetail = useMemo(
		() => zoomForStopUi >= STOP_MARKERS_DETAIL_ZOOM && !hideUserPositionForZoom,
		[zoomForStopUi, hideUserPositionForZoom],
	);

	const stopFetchBoundsKey = viewportForStops?.bounds
		? `${viewportForStops.bounds.north.toFixed(5)},${viewportForStops.bounds.south.toFixed(5)},${viewportForStops.bounds.east.toFixed(5)},${viewportForStops.bounds.west.toFixed(5)}`
		: null;

	useEffect(() => {
		if (!mapReady || !stopFetchBoundsKey) return;
		const bounds = viewportForStopsRef.current?.bounds;
		if (!bounds) return;

		let cancelled = false;
		let fetchCtrl: AbortController | null = null;

		const debounceTimer = setTimeout(() => {
			fetchCtrl = new AbortController();
			const ctrl = fetchCtrl;
			void (async () => {
				try {
					const expanded = expandStopQueryBounds(
						bounds,
						MAP_STOPS_BOUNDS_EXPAND_RATIO,
						operatorMapView.restriction,
					);
					const snapped = snapStopQueryBounds(expanded);
					const q = new URLSearchParams({
						north: String(snapped.north),
						south: String(snapped.south),
						east: String(snapped.east),
						west: String(snapped.west),
					});
					const url = appendOperatorToApiUrl(
						`/api/stops/positions?${q}`,
						mapOperatorForView,
					);
					const res = await fetch(url, {
						signal: ctrl.signal,
						cache: "force-cache",
					});
					if (!res.ok || cancelled) return;
					const data = (await res.json()) as StopsPositionsFile;
					if (!cancelled && Array.isArray(data.stops) && data.stops.length > 0) {
						setAllStopPositions((prev) => {
							if (!prev?.length) return data.stops;
							const m = new Map<string, IStopPositionJson>();
							for (const s of prev) m.set(s.id, s);
							for (const s of data.stops) m.set(s.id, s);
							return Array.from(m.values());
						});
					}
				} catch {
					if (cancelled || ctrl.signal.aborted) return;
					try {
						const res = await fetch("/stops-positions.json", {
							cache: "force-cache",
						});
						if (!res.ok || cancelled) return;
						let data = (await res.json()) as StopsPositionsFile;
						if (
							!cancelled &&
							Array.isArray(data.stops) &&
							data.stops.length === 0
						) {
							const resApi = await fetch(
								appendOperatorToApiUrl(
									"/api/stops/positions",
									mapOperatorForView,
								),
							);
							if (resApi.ok) {
								data = (await resApi.json()) as StopsPositionsFile;
							}
						}
						if (
							!cancelled &&
							Array.isArray(data.stops) &&
							data.stops.length > 0
						) {
							setAllStopPositions(data.stops);
						}
					} catch {
						// ignore
					}
				}
			})();
		}, MAP_STOPS_POSITIONS_FETCH_DEBOUNCE_MS);

		return () => {
			clearTimeout(debounceTimer);
			cancelled = true;
			fetchCtrl?.abort();
		};
	}, [
		mapReady,
		stopFetchBoundsKey,
		mapOperatorForView,
		operatorMapView.restriction,
	]);

	useEffect(() => {
		return () => {
			if (mapViewportDebounceRef.current) {
				clearTimeout(mapViewportDebounceRef.current);
				mapViewportDebounceRef.current = null;
			}
		};
	}, []);

	const handleCameraChanged = useCallback(
		(e: MapCameraChangedEvent) => {
			const d = e.detail;
			queueMapViewport(d.zoom, d.bounds);
		},
		[queueMapViewport],
	);

	const beginVectorMapAttach = useCallback(
		(e: MapEvent, fromTilesLoaded: boolean) => {
			const map = e.map as google.maps.Map;
			mapRef.current = map;
			const z = map.getZoom() ?? 10;
			const b = map.getBounds();
			if (!b) return;
			const boundsJson = b.toJSON();
			if (mapViewportDebounceRef.current) {
				clearTimeout(mapViewportDebounceRef.current);
				mapViewportDebounceRef.current = null;
			}
			zoomRef.current = z;
			startTransition(() => {
				setMapViewport({ zoom: z, bounds: boundsJson });
			});

			if (fromTilesLoaded) {
				if (vectorFirstTilesLoadedAtRef.current === null) {
					vectorFirstTilesLoadedAtRef.current = Date.now();
				}
				vectorTilesLoadedGateRef.current = true;
			}

			const scheduleVectorPaintReady = () => {
				if (!vectorTilesLoadedGateRef.current) return;
				if (vectorPaintDebounceTimerRef.current) {
					clearTimeout(vectorPaintDebounceTimerRef.current);
				}
				const t0 = vectorFirstTilesLoadedAtRef.current;
				const sinceTiles =
					t0 === null ? 0 : Date.now() - t0;
				const remainingMinAfterTiles = Math.max(
					0,
					MAP_VECTOR_PAINT_POST_TILES_MIN_MS - sinceTiles,
				);
				const delay = Math.max(
					MAP_VECTOR_PAINT_IDLE_DEBOUNCE_MS,
					remainingMinAfterTiles,
				);
				vectorPaintDebounceTimerRef.current = setTimeout(() => {
					vectorPaintDebounceTimerRef.current = null;
					clearVectorPaintIdleWatchers();
					if (!mapRef.current) return;
					setMapReady(true);
				}, delay);
			};

			const onMapIdle = () => {
				scheduleVectorPaintReady();
			};

			if (!vectorPaintIdleListenerRef.current) {
				vectorPaintIdleListenerRef.current = google.maps.event.addListener(
					map,
					"idle",
					onMapIdle,
				);
			}
			// Efter tiles: starta debounce (kartan kan redan vara idle utan nytt idle-event).
			if (fromTilesLoaded) {
				scheduleVectorPaintReady();
			}
		},
		[clearVectorPaintIdleWatchers],
	);

	useEffect(() => {
		return () => {
			clearVectorPaintIdleWatchers();
		};
	}, [clearVectorPaintIdleWatchers]);

	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current;
		if (!map) return;

		const endFollow = () => setFollowBus(false);

		const dragListener = google.maps.event.addListener(
			map,
			"dragstart",
			endFollow,
		);
		const div = map.getDiv();
		const onWheel = () => endFollow();
		div.addEventListener("wheel", onWheel, { passive: true });

		return () => {
			google.maps.event.removeListener(dragListener);
			div.removeEventListener("wheel", onWheel);
		};
	}, [mapReady]);

	useEffect(() => {
		if (!userPosition) return;

		const tripsAtClosestStop = getTripsByStopId(tripData.currentTrips);

		if (
			JSON.stringify(tripsAtClosestStop) !==
			JSON.stringify(userPosition.tripsAtClosestStop)
		) {
			setUserPosition((prev) => {
				if (!prev) return null;
				return {
					...prev,
					tripsAtClosestStop,
				};
			});
		}
	}, [tripData.currentTrips, getTripsByStopId, userPosition, setUserPosition]);

	useEffect(() => {
		if (!mapStopPreview || !mapRef.current || !mapReady) return;
		mapRef.current.panTo({
			lat: mapStopPreview.stop.stop_lat,
			lng: mapStopPreview.stop.stop_lon,
		});
		const z = mapRef.current.getZoom() ?? 10;
		if (z < 18) {
			mapRef.current.setZoom(18);
		}
	}, [mapStopPreview, mapReady]);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !selectedStopForSchedule) return;
		const want = mapStopPanRequestIdRef.current;
		if (!want || want !== selectedStopForSchedule.stop_id) return;
		mapStopPanRequestIdRef.current = null;
		mapRef.current.panTo({
			lat: selectedStopForSchedule.stop_lat,
			lng: selectedStopForSchedule.stop_lon,
		});
		const z = mapRef.current.getZoom() ?? 10;
		if (z < 18) {
			mapRef.current.setZoom(18);
		}
	}, [mapReady, selectedStopForSchedule]);

	useEffect(() => {
		if (!selectedStopForSchedule) return;
		setShowCurrentTrips(true);
	}, [selectedStopForSchedule]);

	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		throw new Error("GOOGLE_MAPS_API_KEY is not defined");
	}

	const zoomIn = useCallback((GoogleMap: google.maps.Map) => {
		setFollowBus(false);
		// biome-ignore lint/style/noNonNullAssertion: <Returns the zoom of the map. If the zoom has not been set then the result is undefined.>
		GoogleMap.setZoom(GoogleMap.getZoom()! + 1);
	}, []);
	const zoomOut = useCallback((GoogleMap: google.maps.Map) => {
		setFollowBus(false);
		// biome-ignore lint/style/noNonNullAssertion: <Returns the zoom of the map. If the zoom has not been set then the result is undefined.>
		GoogleMap.setZoom(GoogleMap.getZoom()! - 1);
	}, []);

	const handleMyPositionClick = useCallback(() => {
		if (!mapReady || !userPosition || !mapRef.current) return;
		setMyPositionErrorMessage(null);

		const { lat, lng } = userPosition;
		const matchedOperator = findOperatorForPosition(lat, lng);
		if (!matchedOperator) {
			setMyPositionErrorMessage(
				"Din position ligger utanför tillgängliga regioner just nu.",
			);
			return;
		}
		if (matchedOperator !== mapOperatorForView) {
			const p = new URLSearchParams(searchParams.toString());
			p.delete("operator");
			p.set("focusUser", "1");
			const qs = p.toString();
			const base = searchPathForOperator(matchedOperator);
			router.push(qs ? `${base}?${qs}` : base);
			return;
		}

		mapRef.current.panTo({ lat, lng });
		if ((mapRef.current.getZoom() ?? 10) < 14) {
			mapRef.current.setZoom(14);
		}
	}, [
		mapReady,
		userPosition,
		mapOperatorForView,
		findOperatorForPosition,
		searchParams,
		router,
	]);

	const getWindowZoomLevel = useCallback(() => {
		const zoomLevel = ((window.outerWidth - 10) / window.innerWidth) * 100;
		setCurrentWindowZoomLevel(zoomLevel);
		return zoomLevel;
	}, []);

	const handleTripSelect = useCallback(
		(tripId: string) => {
			const vehicle = filteredVehicles.data.find(
				(v) => v.trip.tripId === tripId,
			);
			if (vehicle) {
				setFollowBus(false);
				setInfoWindowActive(false);
				setActiveMarkerId(null);

				setTimeout(() => {
					setActiveMarkerId(vehicle.vehicle.id);
					setClickedOutside(false);
					setInfoWindowActive(true);

					if (mapRef.current && vehicle.position) {
						mapRef.current.panTo({
							lat: vehicle.position.latitude,
							lng: vehicle.position.longitude,
						});
					}
					if (isMobile) {
						setShowCurrentTrips(true);
					}
				}, 50);
				mapRef?.current?.setZoom(17);
			}
		},
		[filteredVehicles, isMobile],
	);

	useEffect(() => {
		window.addEventListener("resize", getWindowZoomLevel);
		window.addEventListener("zoom", getWindowZoomLevel);

		getWindowZoomLevel();

		return () => {
			window.removeEventListener("resize", getWindowZoomLevel);
			window.removeEventListener("zoom", getWindowZoomLevel);
		};
	}, [getWindowZoomLevel]);

	useEffect(() => {
		if (!mapReady || !mapRef.current) return;
		const map = mapRef.current;
		const listener = google.maps.event.addListener(map, "zoom_changed", () => {
			const newZoom = mapRef.current?.getZoom();
			if (newZoom === undefined || newZoom === null) {
				return;
			}
			if (zoomRef.current !== newZoom) {
				zoomRef.current = newZoom;
				setHideUserPositionForZoom(true);
				if (hideUserPositionTimeoutRef.current) {
					clearTimeout(hideUserPositionTimeoutRef.current);
				}
				hideUserPositionTimeoutRef.current = setTimeout(() => {
					setHideUserPositionForZoom(false);
					hideUserPositionTimeoutRef.current = null;
				}, 400);
			}
		});

		return () => {
			if (hideUserPositionTimeoutRef.current) {
				clearTimeout(hideUserPositionTimeoutRef.current);
			}
			google.maps.event.removeListener(listener);
		};
	}, [mapReady]);

	const routeShapesCacheRef = useRef<Map<string, IShapes[]>>(new Map());
	const routeShapes = useMemo(() => {
		const byId = new Map<string, { shape_id: string; points: IShapes[] }>();

		for (const ls of tripData.lineShapes ?? []) {
			if (ls.points?.length) {
				byId.set(ls.shape_id, { shape_id: ls.shape_id, points: ls.points });
			}
		}

		for (const v of filteredVehicles.data) {
			if (!v.shapePoints?.length) continue;
			const id = v.shapePoints[0].shape_id;
			const points = v.shapePoints;
			const cached = routeShapesCacheRef.current.get(id);
			const sameShape =
				cached &&
				cached.length === points.length &&
				cached[0].shape_pt_lat === points[0].shape_pt_lat &&
				cached[0].shape_pt_lon === points[0].shape_pt_lon &&
				cached[cached.length - 1].shape_pt_lat ===
					points[points.length - 1].shape_pt_lat &&
				cached[cached.length - 1].shape_pt_lon ===
					points[points.length - 1].shape_pt_lon;
			const toUse = sameShape ? cached : points;
			if (!sameShape) routeShapesCacheRef.current.set(id, points);
			byId.set(id, { shape_id: id, points: toUse });
		}

		return Array.from(byId.values());
	}, [filteredVehicles.data, tripData.lineShapes]);

	const lineShapesForFit: ShapeGroup[] = useMemo(
		() => tripData.lineShapes ?? [],
		[tripData.lineShapes],
	);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !linjeParam) return;

		const bounds = boundsFromLineOrRouteShapes(lineShapesForFit, routeShapes);
		const initialLinje = initialLinjeFromDocumentRef.current ?? "";
		const allowInitialDocumentFit =
			!hasDoneInitialDocumentLinjeFitRef.current &&
			Boolean(initialLinje) &&
			linjeParam === initialLinje;

		const shouldFit = mapFitParam || allowInitialDocumentFit;

		if (!bounds) {
			return;
		}

		if (!shouldFit) {
			lastLineShapeFitKeyRef.current = linjeParam;
			return;
		}

		hasDoneInitialDocumentLinjeFitRef.current = true;
		lastLineShapeFitKeyRef.current = linjeParam;

		const map = mapRef.current;
		setFollowBus(false);

		map.fitBounds(bounds, {
			top: LINE_SHAPE_FIT_PADDING,
			right: LINE_SHAPE_FIT_PADDING,
			bottom: LINE_SHAPE_FIT_PADDING,
			left: LINE_SHAPE_FIT_PADDING,
		});
		const capListener = google.maps.event.addListenerOnce(map, "idle", () => {
			const zz = map.getZoom();
			if (zz != null && zz > LINE_SHAPE_FIT_MAX_ZOOM) {
				map.setZoom(LINE_SHAPE_FIT_MAX_ZOOM);
			}
			if (mapFitParam && typeof window !== "undefined") {
				const params = new URLSearchParams(window.location.search);
				if (params.has("mapfit")) {
					params.delete("mapfit");
					const qs = params.toString();
					const base = searchPathForOperator(mapOperatorForView);
					router.replace(qs ? `${base}?${qs}` : base);
				}
			}
		});
		return () => {
			google.maps.event.removeListener(capListener);
		};
	}, [
		mapReady,
		linjeParam,
		lineShapesForFit,
		routeShapes,
		mapFitParam,
		router,
		mapOperatorForView,
	]);

	const hasRouteData =
		filteredVehicles.data.length > 0 ||
		tripData.upcomingTrips.length > 0 ||
		tripData.lineStops.length > 0 ||
		tripData.lineShapes.length > 0;

	const mapZoom = mapViewport?.zoom ?? MAP_TARGET_INITIAL_ZOOM;
	const showMapStopPreview =
		Boolean(mapStopPreview) && mapReady && mapZoom >= STOP_MARKERS_DETAIL_ZOOM;

	useEffect(() => {
		setIsCurrentTripsOpen(showCurrentTrips);
		return () => setIsCurrentTripsOpen(false);
	}, [showCurrentTrips, setIsCurrentTripsOpen]);

	return (
		<div className="map-client-root">
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<GoogleMap
					key={`${mapOperatorForView}:${mapMountKey}`}
					mapId={"fb3dad0c952dfd27"}
					style={{ width: "100vw", height: "100dvh", zIndex: "unset" }}
					defaultZoom={
						linjeParam || mapBootstrapZoomDoneInTab
							? MAP_TARGET_INITIAL_ZOOM
							: MAP_BOOTSTRAP_ZOOM
					}
					minZoom={10}
					defaultCenter={defaultMapCenter}
					gestureHandling={"greedy"}
					onTilesLoaded={(e: MapEvent) => {
						beginVectorMapAttach(e, true);
					}}
					onIdle={(e: MapEvent) => {
						if (!mapReady) {
							beginVectorMapAttach(e, false);
						}
					}}
					onCameraChanged={handleCameraChanged}
					disableDefaultUI={true}
					rotateControl={false}
					mapTypeControl={false}
					streetViewControl={false}
					fullscreenControl={false}
					onClick={(e: MapMouseEvent) => {
						if (isClickFromStopUi(e)) return;
						setClickedOutside(true);
						setMapStopPreview(null);
					}}
					colorScheme="DARK"
					renderingType={RenderingType.VECTOR}
					reuseMaps={true}
					restriction={{
						latLngBounds: operatorMapView.restriction,
					}}
				>
					<MapControl position={ControlPosition.INLINE_END_BLOCK_CENTER}>
						<MapControlButtons
							googleMapRef={mapRef}
							zoomIn={zoomIn}
							zoomOut={zoomOut}
							setShowCurrentTrips={setShowCurrentTrips}
							showCurrentTrips={showCurrentTrips}
							filteredVehicles={filteredVehicles}
							setFollowBus={setFollowBus}
							followBus={activeMarkerId ? followBus : false}
							activeMarker={activeMarkerId !== null}
							mapReady={mapReady}
							onMyPositionClick={handleMyPositionClick}
						/>
					</MapControl>
					<VehicleMarkers
						googleMapRef={mapRef}
						clickedOutside={clickedOutside}
						setClickedOutside={setClickedOutside}
						vehicles={filteredVehicles.data}
						currentTrips={tripData.currentTrips}
						lineShapes={tripData.lineShapes}
						setInfoWindowActiveExternal={setInfoWindowActive}
						infoWindowActiveExternal={infoWindowActive}
						followBus={followBus}
						setFollowBus={setFollowBus}
						activeMarkerId={activeMarkerId}
						setActiveMarkerId={setActiveMarkerId}
						showCurrentTrips={showCurrentTrips}
					/>
					{mapReady &&
						routeShapes.map(
							(s) =>
								s.points && (
									<RouteShapePolyline
										key={s.shape_id}
										googleMapRef={mapRef}
										shapePoints={s.points}
										mapReady={mapReady}
										animateReveal
										animationDuration={1.8}
										hasActiveVehicle={filteredVehicles.data.length > 0}
									/>
								),
						)}
					{mapReady && visibleStopMarkers.length > 0 && (
						<StopMarkersLayer
							stops={stopsForStopLayer}
							mapRef={mapRef}
							onStopClick={handleStopMarkerClick}
							stopMarkersVisible={stopMarkersVisible}
							detailMode={stopMarkersDetail}
							activeStopId={
								showCurrentTrips ? selectedStopForSchedule?.stop_id : undefined
							}
						/>
					)}
					{showCurrentTrips && hasRouteData && userPosition && (
						<CurrentTrips
							onTripSelect={handleTripSelect}
							mapRef={mapRef}
							followedTripId={followedTripId ?? fallbackFollowed.tripId}
							closestStop={
								selectedStopForSchedule ??
								activeVehicleBoardStop ??
								userPosition?.closestStop ??
								undefined
							}
						/>
					)}
					{showMapStopPreview && mapStopPreview && (
						<MapStopPreview
							preview={mapStopPreview}
							onRouteSelect={handlePreviewLineClick}
						/>
					)}
					{userPosition && mapRef.current && (
						<AdvancedMarker
							title={"Min position"}
							anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
							zIndex={50}
							position={
								new google.maps.LatLng({
									lat: userPosition.lat,
									lng: userPosition.lng,
								})
							}
						>
							<div
								className={`user-location ${(mapRef.current?.getZoom() ?? 0) >= 12 && !hideUserPositionForZoom ? "--visible" : ""}`}
							/>
							<div
								className={`user-location__container ${(mapRef.current?.getZoom() ?? 0) >= 12 && !hideUserPositionForZoom ? "--visible" : ""}`}
							>
								<span
									className="user-location__text"
									style={{
										fontSize: (mapRef.current?.getZoom() ?? 10) * 0.8,
									}}
								>
									Min position
								</span>
							</div>
						</AdvancedMarker>
					)}
				</GoogleMap>
			</APIProvider>
			{!mapReady && (
				<output
					className="map-loading-overlay"
					aria-live="polite"
					aria-busy="true"
				>
					<span className="map-loading-spinner" aria-hidden />
					<span className="map-loading-overlay__text">Laddar karta …</span>
				</output>
			)}
			{!userPosition && <UserMessage />}
			{myPositionErrorMessage && userPosition && (
				<UserMessage
					title="Position utanför region."
					message={myPositionErrorMessage}
				/>
			)}
			<div id="follow-bus-border" />
		</div>
	);
}
