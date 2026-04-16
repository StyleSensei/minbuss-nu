"use client";

export const metadata = {
	title: "Se närmaste bussen live i Stockholm",
};

import type { IDbData } from "@shared/models/IDbData";
import type { IShapes } from "@shared/models/IShapes";
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
import { useRouter, useSearchParams } from "next/navigation";
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
import { Paths } from "../paths";
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

const DEFAULT_MAP_CENTER_FALLBACK = { lat: 59.33258, lng: 18.0649 } as const;

/** Utzoomad start när ingen linje är vald — efter första idle zoomar vi in (löser sporadiska svarta rutor / att lager inte hinner med förrän man zoomar manuellt). */
const MAP_BOOTSTRAP_ZOOM = 11;
const MAP_TARGET_INITIAL_ZOOM = 14;

/**
 * Överlever unmount när man lämnar kartrouten (samma flik) så vi inte zoomar ut/in igen vid SPA-tillbaknavigation.
 * Nollställs vid full sidladdning.
 */
let mapBootstrapZoomDoneInTab = false;

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

function lineShapeFitSignature(
	lineShapes: ShapeGroup[],
	routeShapes: ShapeGroup[],
): string {
	const fromLine = lineShapes
		.filter((ls) => (ls.points?.length ?? 0) >= 2)
		.map((ls) => `${ls.shape_id}:${ls.points!.length}`)
		.sort()
		.join(",");
	if (fromLine) return `L:${fromLine}`;
	const fromRoute = routeShapes
		.filter((s) => (s.points?.length ?? 0) >= 2)
		.map((s) => `${s.shape_id}:${s.points!.length}`)
		.sort()
		.join(",");
	return `R:${fromRoute}`;
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
	const searchParams = useSearchParams();
	const mapRef = useRef<google.maps.Map | null>(null);
	const [clickedOutside, setClickedOutside] = useState(false);
	const [zoomWindowLevel, setCurrentWindowZoomLevel] = useState(100);
	const [showCurrentTrips, setShowCurrentTrips] = useState(false);
	const [infoWindowActive, setInfoWindowActive] = useState(false);
	const [followBus, setFollowBus] = useState(false);
	const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
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
	/** defaultCenter gäller bara vid mount; geolokering kommer ofta senare — pan en gång när position finns (utan linje i URL). */
	const userGeolocatePanDoneRef = useRef(false);
	const prevLinjeParamForUserPanRef = useRef("");
	const mapInitialZoomBootstrapDoneRef = useRef(false);

	const linjeParam = searchParams.get("linje")?.trim().toUpperCase() ?? "";

	const defaultMapCenter = useMemo(
		() =>
			userPosition
				? { lat: userPosition.lat, lng: userPosition.lng }
				: DEFAULT_MAP_CENTER_FALLBACK,
		[userPosition],
	);

	useEffect(() => {
		lastLineShapeFitKeyRef.current = "";
	}, [linjeParam]);

	useEffect(() => {
		if (prevLinjeParamForUserPanRef.current && !linjeParam) {
			userGeolocatePanDoneRef.current = false;
		}
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
			router.push(
				`${Paths.Search}?linje=${encodeURIComponent(routeShortName)}`,
			);
		},
		[
			mapStopPreview,
			router,
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
					`/api/stops/${encodeURIComponent(stop.id)}/routes`,
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
					router.push(
						`${Paths.Search}?linje=${encodeURIComponent(sortedRoutes[0])}`,
					);
				}
			} catch (e) {
				if (gen !== stopPreviewFetchGenRef.current) return;
				console.error(e);
			}
		},
		[
			router,
			searchParams,
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
		const ctrl = new AbortController();
		void (async () => {
			try {
				const expanded = expandStopQueryBounds(
					bounds,
					MAP_STOPS_BOUNDS_EXPAND_RATIO,
				);
				const snapped = snapStopQueryBounds(expanded);
				const q = new URLSearchParams({
					north: String(snapped.north),
					south: String(snapped.south),
					east: String(snapped.east),
					west: String(snapped.west),
				});
				const res = await fetch(`/api/stops/positions?${q}`, {
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
						const resApi = await fetch("/api/stops/positions");
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
		return () => {
			cancelled = true;
			ctrl.abort();
		};
	}, [mapReady, stopFetchBoundsKey]);

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

	const lineShapeFitSignatureMemo = useMemo(
		() => lineShapeFitSignature(lineShapesForFit, routeShapes),
		[lineShapesForFit, routeShapes],
	);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !linjeParam) return;

		const bounds = boundsFromLineOrRouteShapes(lineShapesForFit, routeShapes);
		if (!bounds) return;

		const key = `${linjeParam}|${lineShapeFitSignatureMemo}`;
		if (lastLineShapeFitKeyRef.current === key) return;
		lastLineShapeFitKeyRef.current = key;

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
		});
		return () => {
			google.maps.event.removeListener(capListener);
		};
	}, [
		mapReady,
		linjeParam,
		lineShapesForFit,
		routeShapes,
		lineShapeFitSignatureMemo,
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
		<div>
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				<GoogleMap
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
						const map = e.map as google.maps.Map;
						mapRef.current = map;
						setMapReady(true);
						const z = map.getZoom() ?? 10;
						const b = map.getBounds();
						if (b) {
							const boundsJson = b.toJSON();
							if (mapViewportDebounceRef.current) {
								clearTimeout(mapViewportDebounceRef.current);
								mapViewportDebounceRef.current = null;
							}
							zoomRef.current = z;
							startTransition(() => {
								setMapViewport({ zoom: z, bounds: boundsJson });
							});
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
						latLngBounds: { north: 60, south: 58.5, east: 20, west: 16.5 },
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
						/>
					</MapControl>
					<VehicleMarkers
						googleMapRef={mapRef}
						clickedOutside={clickedOutside}
						setClickedOutside={setClickedOutside}
						vehicles={filteredVehicles.data}
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
			{!userPosition && <UserMessage />}
			<div id="follow-bus-border" />
		</div>
	);
}
