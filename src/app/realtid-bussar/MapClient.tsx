"use client";

import type { IDbData } from "@shared/models/IDbData";
import { ensureDeviceCompassListening } from "../utilities/deviceCompassHeading";
import {
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	APIProvider,
	ControlPosition,
	Map as GoogleMap,
	MapControl,
	type MapCameraChangedEvent,
	type MapEvent,
	type MapMouseEvent,
	RenderingType,
} from "@vis.gl/react-google-maps";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CurrentTrips } from "../components/CurrentTrips";
import { InfoWindow } from "../components/InfoWindow";
import { MapControlButtons } from "../components/MapControlButtons";
import RouteShapePolyline from "../components/RouteShapePolyline";
import UserMessage from "../components/UserMessage";
import { UserLocationMarker } from "../components/UserLocationMarker";
import VehicleMarkers from "../components/VehicleMarkers";
import { useDataContext } from "../context/DataContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useStopBoardShapes } from "../hooks/useStopBoardShapes";
import { useStopDepartures } from "../hooks/useStopDepartures";
import { parseOperatorFromRealtimePathname, STOP_SEARCH_QUERY } from "../paths";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";
import { createRouteShapeColorMap } from "../utilities/routeShapeColors";
import {
	filterStopBoardByLines,
	filterStopBoardShapes,
	toggleStopBoardLine,
} from "../utilities/stopBoardLineFilter";
import { hasDisplayablePlatformCode } from "../utilities/stopBoardStopResolution";
import { useAutoOpenCurrentTrips } from "./mapClient/hooks/useAutoOpenCurrentTrips";
import { useEndFollowOnUserGesture } from "./mapClient/hooks/useEndFollowOnUserGesture";
import { useFollowBusBorderClass } from "./mapClient/hooks/useFollowBusBorderClass";
import { useHideUserMarkerDuringZoom } from "./mapClient/hooks/useHideUserMarkerDuringZoom";
import { useInitialRegionFromGeo } from "./mapClient/hooks/useInitialRegionFromGeo";
import { useLandingChromeHide } from "./mapClient/hooks/useLandingChromeHide";
import { useLineShapeFitBounds } from "./mapClient/hooks/useLineShapeFitBounds";
import { useMapBootRecoveryAndOnline } from "./mapClient/hooks/useMapBootRecoveryAndOnline";
import {
	useInitialLinjeFromDocumentRef,
	useMapInitialCamera,
} from "./mapClient/hooks/useMapInitialCamera";
import { useMapInitialCenter } from "./mapClient/hooks/useMapInitialCenter";
import { useMapOperatorResolution } from "./mapClient/hooks/useMapOperatorResolution";
import { useMapStopCameraPans } from "./mapClient/hooks/useMapStopCameraPans";
import { useMapVectorReady } from "./mapClient/hooks/useMapVectorReady";
import { useMapViewportAndStopsFetch } from "./mapClient/hooks/useMapViewportAndStopsFetch";
import { useMobileInfoWindowCollapsesTrips } from "./mapClient/hooks/useMobileInfoWindowCollapsesTrips";
import { useOperatorsMeta } from "./mapClient/hooks/useOperatorsMeta";
import { useRouteShapesForMap } from "./mapClient/hooks/useRouteShapesForMap";
import { useSyncTripsIntoUserPosition } from "./mapClient/hooks/useSyncTripsIntoUserPosition";
import { useWindowZoomPercent } from "./mapClient/hooks/useWindowZoomPercent";
import {
	MAP_BOOTSTRAP_ZOOM,
	MAP_TARGET_INITIAL_ZOOM,
	mapBootstrapZoomTabState,
} from "./mapClient/mapClientConstants";
import {
	hrefForOperatorAtUserPosition,
	shouldCenterMapOnUserPosition,
} from "./mapClient/mapClientRegionNavigation";
import {
	isClickFromStopUi,
	resolveActiveStopMarkerId,
} from "./mapClient/mapClientStopUi";
import { StopMarkersLayer } from "./StopMarkersLayer";
import {
	buildFocusedStationMarkers,
	type IStopPositionJson,
} from "./stopPositionsTypes";

export default function MapClient() {
	const {
		filteredVehicles,
		tripData,
		userPosition,
		setUserPosition,
		isCurrentTripsOpen,
		setIsCurrentTripsOpen,
		selectedStopForSchedule,
		setSelectedStopForSchedule,
		selectedStopRouteLines,
		setSelectedStopRouteLines,
		stopBoardData,
		selectedStopLineFilter,
		selectedStopPlatformFilter,
		setSelectedStopPlatformFilter,
		selectedStopModeFilter,
		setSelectedStopModeFilter,
		setSelectedStopLineFilter,
		activeFollowedTripId,
		setActiveFollowedTripId,
	} = useDataContext();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const mapRef = useRef<google.maps.Map | null>(null);
	const zoomRef = useRef<number>(8);
	const [clickedOutside, setClickedOutside] = useState(false);
	const showCurrentTrips = isCurrentTripsOpen;
	const setShowCurrentTrips = setIsCurrentTripsOpen;
	const [infoWindowActive, setInfoWindowActive] = useState(false);
	const [followBus, setFollowBus] = useState(false);
	const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
	const [activeStopMarkerId, setActiveStopMarkerId] = useState<string | null>(
		null,
	);
	const [scheduleInfoBoardStop, setScheduleInfoBoardStop] =
		useState<IDbData | null>(null);
	const [myPositionErrorMessage, setMyPositionErrorMessage] = useState<
		string | null
	>(null);
	const [mapBearing, setMapBearing] = useState(0);
	const linjeParam = searchParams.get("linje")?.trim().toUpperCase() ?? "";
	const hallplatsParam = searchParams.get(STOP_SEARCH_QUERY)?.trim() ?? "";
	const urlSearchTarget = linjeParam || hallplatsParam;
	const isPinnedStopMode = selectedStopForSchedule !== null && !linjeParam;
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
	const visibleVehicles = isPinnedStopMode
		? filteredStopBoard.vehicles
		: filteredVehicles.data;
	const visibleVehicleResult = useMemo(
		() => ({
			data: visibleVehicles,
			error: isPinnedStopMode ? undefined : filteredVehicles.error,
		}),
		[filteredVehicles.error, isPinnedStopMode, visibleVehicles],
	);
	const markerTripRows = useMemo(() => {
		if (!isPinnedStopMode) return tripData.currentTrips;
		const seen = new Set<string>();
		return [...tripData.currentTrips, ...filteredStopBoard.departures].filter(
			(row) => {
				const key = `${row.trip_id}:${row.stop_id}:${row.stop_sequence}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			},
		);
	}, [filteredStopBoard.departures, isPinnedStopMode, tripData.currentTrips]);
	const followedTripId = useMemo(() => {
		if (!activeMarkerId) return null;
		return (
			visibleVehicles.find((v) => v.vehicle.id === activeMarkerId)?.trip
				?.tripId ?? null
		);
	}, [activeMarkerId, visibleVehicles]);
	const fallbackFollowed = useMemo(() => {
		const baseStop =
			selectedStopForSchedule ?? userPosition?.closestStop ?? null;
		if (!baseStop || visibleVehicles.length === 0) {
			return { tripId: null as string | null };
		}
		const matchingRows = markerTripRows.filter(
			(row) =>
				row.stop_id === baseStop.stop_id ||
				row.stop_name.trim() === baseStop.stop_name.trim(),
		);
		let candidateTripId =
			matchingRows.find((row) =>
				visibleVehicles.some((v) => v.trip.tripId === row.trip_id),
			)?.trip_id ?? null;
		if (!candidateTripId) {
			candidateTripId =
				(isPinnedStopMode
					? filteredStopBoard.departures
					: tripData.upcomingTrips
				).find((row) =>
					visibleVehicles.some((v) => v.trip.tripId === row.trip_id),
				)?.trip_id ?? null;
		}
		if (!candidateTripId) {
			return { tripId: null as string | null };
		}
		return { tripId: candidateTripId };
	}, [
		selectedStopForSchedule,
		userPosition?.closestStop,
		visibleVehicles,
		markerTripRows,
		isPinnedStopMode,
		filteredStopBoard.departures,
		tripData.upcomingTrips,
	]);
	useEffect(() => {
		if (!isPinnedStopMode || !activeMarkerId) return;
		if (
			visibleVehicles.some((vehicle) => vehicle.vehicle.id === activeMarkerId)
		) {
			return;
		}
		setActiveMarkerId(null);
		setFollowBus(false);
		setInfoWindowActive(false);
		setActiveFollowedTripId(null);
	}, [
		activeMarkerId,
		isPinnedStopMode,
		setActiveFollowedTripId,
		visibleVehicles,
	]);
	const [mapReady, setMapReady] = useState(false);
	const [mapMountKey, setMapMountKey] = useState(0);
	const isMobile = useIsMobile();
	const stopPreviewFetchGenRef = useRef(0);

	const operatorUrlParam = searchParams.get("operator")?.trim() ?? "";
	const mapFitParam = searchParams.get("mapfit") === "1";
	const focusUserParam = searchParams.get("focusUser") === "1";

	const operatorSlugFromPath = useMemo(
		() => parseOperatorFromRealtimePathname(pathname),
		[pathname],
	);

	const operatorsMeta = useOperatorsMeta();
	const { mapOperatorForView, operatorMapView, findOperatorForPosition } =
		useMapOperatorResolution(
			operatorsMeta,
			operatorSlugFromPath,
			operatorUrlParam,
		);
	useStopDepartures(selectedStopForSchedule, mapOperatorForView);
	const stopBoardShapes = useStopBoardShapes(
		selectedStopForSchedule,
		mapOperatorForView,
	);
	const availableStopRouteShapes = useMemo(
		() => filterStopBoardShapes(stopBoardShapes.shapes, stopBoardData.routes),
		[stopBoardData.routes, stopBoardShapes.shapes],
	);
	const filteredStopShapes = useMemo(
		() =>
			filterStopBoardShapes(
				availableStopRouteShapes,
				selectedStopLineFilter,
				selectedStopModeFilter,
			),
		[availableStopRouteShapes, selectedStopLineFilter, selectedStopModeFilter],
	);
	const stopRouteShapeColors = useMemo(
		() =>
			createRouteShapeColorMap(
				availableStopRouteShapes.map((shape) => shape.route_short_name),
			),
		[availableStopRouteShapes],
	);
	const availableStopRouteNames = useMemo(
		() =>
			selectedStopRouteLines ?? [
				...new Set(
					availableStopRouteShapes.map((shape) => shape.route_short_name),
				),
			],
		[availableStopRouteShapes, selectedStopRouteLines],
	);
	const handleRouteShapeClick = useCallback(
		(routeShortName: string) => {
			if (!isPinnedStopMode || !routeShortName.trim()) return;
			setSelectedStopLineFilter((current) =>
				toggleStopBoardLine(current, routeShortName, availableStopRouteNames),
			);
			setShowCurrentTrips(true);
		},
		[
			availableStopRouteNames,
			isPinnedStopMode,
			setSelectedStopLineFilter,
			setShowCurrentTrips,
		],
	);

	const hideUserPositionForZoom = useHideUserMarkerDuringZoom(
		mapReady,
		mapRef,
		zoomRef,
	);
	const focusedStationIds = useMemo(
		() => (isPinnedStopMode ? stopBoardData.stationStopIds : []),
		[isPinnedStopMode, stopBoardData.stationStopIds],
	);
	const focusedStationStops = useMemo(
		() =>
			buildFocusedStationMarkers(
				stopBoardData.children,
				stopBoardData.departures,
				selectedStopForSchedule?.stop_name ?? "",
			),
		[
			selectedStopForSchedule?.stop_name,
			stopBoardData.children,
			stopBoardData.departures,
		],
	);

	const {
		mapViewport,
		setMapViewport,
		mapViewportDebounceRef,
		handleCameraChanged,
		visibleStopMarkers,
		stopsForStopLayer,
		stopMarkersVisible,
		stopMarkersDetail,
		stopMarkersLabels,
	} = useMapViewportAndStopsFetch(
		mapReady,
		mapOperatorForView,
		operatorMapView.restriction,
		focusedStationIds,
		focusedStationStops,
	);

	const handleMapCameraChanged = useCallback(
		(e: MapCameraChangedEvent) => {
			handleCameraChanged(e);
			setMapBearing(e.detail.heading ?? 0);
		},
		[handleCameraChanged],
	);

	const { clearVectorPaintIdleWatchers, beginVectorMapAttach } =
		useMapVectorReady(
			mapRef,
			zoomRef,
			mapViewportDebounceRef,
			setMapReady,
			setMapViewport,
		);

	useMapBootRecoveryAndOnline(
		mapOperatorForView,
		clearVectorPaintIdleWatchers,
		mapReady,
		mapMountKey,
		setMapMountKey,
		mapRef,
		setMapReady,
		setMapViewport,
	);

	const centerMapOnUser = useMemo(
		() =>
			shouldCenterMapOnUserPosition(
				focusUserParam,
				userPosition,
				mapOperatorForView,
				findOperatorForPosition,
			),
		[focusUserParam, userPosition, mapOperatorForView, findOperatorForPosition],
	);

	const initialLinjeFromDocumentRef = useInitialLinjeFromDocumentRef();
	const { lastLineShapeFitKeyRef } = useMapInitialCamera(
		mapReady,
		mapRef,
		mapOperatorForView,
		operatorMapView.defaultCenter,
		urlSearchTarget,
		userPosition,
		focusUserParam,
		centerMapOnUser,
	);

	useLandingChromeHide();
	useFollowBusBorderClass(followBus, visibleVehicles.length);
	useEndFollowOnUserGesture(mapReady, mapRef, setFollowBus);

	useSyncTripsIntoUserPosition(
		userPosition,
		tripData.currentTrips,
		setUserPosition,
		selectedStopForSchedule?.stop_id,
		userPosition?.closestStop?.stop_id,
	);

	useMapStopCameraPans(
		mapReady,
		mapRef,
		selectedStopForSchedule,
		focusedStationStops,
	);

	useAutoOpenCurrentTrips(selectedStopForSchedule, setShowCurrentTrips);
	useMobileInfoWindowCollapsesTrips(
		isMobile,
		infoWindowActive,
		setShowCurrentTrips,
	);

	useWindowZoomPercent();

	const activeLineShapes = isPinnedStopMode
		? filteredStopShapes
		: tripData.lineShapes;
	const shapeVehicles = isPinnedStopMode
		? visibleVehicles
		: filteredVehicles.data;
	const { routeShapes, lineShapesForFit } = useRouteShapesForMap(
		shapeVehicles,
		activeLineShapes,
	);
	const activeShapeScopeKey = isPinnedStopMode
		? `${selectedStopForSchedule?.stop_id ?? ""}:${selectedStopModeFilter ?? "all"}:${selectedStopPlatformFilter ?? "all"}:${selectedStopLineFilter?.join(",") ?? "all"}`
		: linjeParam;

	useLineShapeFitBounds(
		mapReady,
		mapRef,
		activeShapeScopeKey,
		lineShapesForFit,
		routeShapes,
		isPinnedStopMode ? false : mapFitParam,
		false,
		mapOperatorForView,
		initialLinjeFromDocumentRef,
		lastLineShapeFitKeyRef,
		setFollowBus,
	);

	const regionResolved = useInitialRegionFromGeo(
		userPosition,
		operatorsMeta,
		mapOperatorForView,
		findOperatorForPosition,
		focusUserParam,
	);
	const { mapMountReady, mapInitialCenter } = useMapInitialCenter(
		userPosition,
		operatorMapView.defaultCenter,
		urlSearchTarget,
		centerMapOnUser,
	);
	const canMountMap =
		regionResolved && mapMountReady && mapInitialCenter != null;

	const handleStopMarkerClick = useCallback(
		async (stop: IStopPositionJson) => {
			if (stop.presentation === "platform-label") return;
			const gen = ++stopPreviewFetchGenRef.current;
			setActiveStopMarkerId(stop.id);
			if (stop.isParent) {
				setFollowBus(false);
			}
			const selectedPlatformId =
				stop.presentation === "group-stop" ||
				stop.isParent ||
				stop.locationType === 2 ||
				!hasDisplayablePlatformCode(stop.platformCode)
					? null
					: stop.locationType === 0
						? stop.id
						: null;
			const stopIdForTrips = stop.parent || stop.id;
			try {
				const res = await fetch(
					appendOperatorToApiUrl(
						`/api/stops/${encodeURIComponent(stopIdForTrips)}/routes`,
						mapOperatorForView,
					),
				);
				if (gen !== stopPreviewFetchGenRef.current) return;
				if (!res.ok) {
					setActiveStopMarkerId((current) =>
						current === stop.id ? null : current,
					);
					return;
				}
				const data = (await res.json()) as {
					stop_id: string;
					stop_name: string;
					platform_code?: string | null;
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
					platform_code: data.platform_code,
					stop_sequence: 0,
					stop_lat: data.stop_lat,
					stop_lon: data.stop_lon,
					feed_version: data.feed_version ?? "",
				};
				setSelectedStopForSchedule(stopDb);
				setSelectedStopRouteLines(sortedRoutes);
				setSelectedStopModeFilter(null);
				setSelectedStopPlatformFilter(selectedPlatformId);
				setSelectedStopLineFilter(null);
				setShowCurrentTrips(true);
			} catch (e) {
				if (gen !== stopPreviewFetchGenRef.current) return;
				setActiveStopMarkerId((current) =>
					current === stop.id ? null : current,
				);
				console.error(e);
			}
		},
		[
			mapOperatorForView,
			setSelectedStopForSchedule,
			setSelectedStopLineFilter,
			setSelectedStopModeFilter,
			setSelectedStopPlatformFilter,
			setSelectedStopRouteLines,
		],
	);

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

	const enableCompassFromUserGesture = useCallback(() => {
		void ensureDeviceCompassListening();
	}, []);

	const handleMyPositionClick = useCallback(() => {
		enableCompassFromUserGesture();
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
			router.push(hrefForOperatorAtUserPosition(matchedOperator, searchParams));
			return;
		}

		mapRef.current.panTo({ lat, lng });
		if ((mapRef.current.getZoom() ?? 10) < 14) {
			mapRef.current.setZoom(14);
		}
	}, [
		enableCompassFromUserGesture,
		mapReady,
		userPosition,
		mapOperatorForView,
		findOperatorForPosition,
		searchParams,
		router,
	]);

	const handleTripSelect = useCallback(
		(tripId: string, boardRow?: IDbData) => {
			const vehicle = visibleVehicles.find((v) => v.trip.tripId === tripId);
			if (vehicle) {
				setScheduleInfoBoardStop(null);
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
					mapRef.current?.setZoom(17);
					if (isMobile) {
						setShowCurrentTrips(false);
					}
				}, 50);
				return;
			}

			const boardStop =
				boardRow ??
				selectedStopForSchedule ??
				userPosition?.closestStop ??
				null;
			setActiveMarkerId(null);
			setFollowBus(false);
			setClickedOutside(false);
			setActiveFollowedTripId(tripId);
			setScheduleInfoBoardStop(boardStop);
			setInfoWindowActive(true);

			if (mapRef.current && boardStop) {
				mapRef.current.panTo({
					lat: +boardStop.stop_lat,
					lng: +boardStop.stop_lon,
				});
				mapRef.current.setZoom(18);
			}
			if (isMobile) {
				setShowCurrentTrips(false);
			}
		},
		[
			visibleVehicles,
			isMobile,
			selectedStopForSchedule,
			userPosition?.closestStop,
			setActiveFollowedTripId,
		],
	);

	useEffect(() => {
		if (!clickedOutside) return;
		setScheduleInfoBoardStop(null);
		if (!activeMarkerId) {
			setActiveFollowedTripId(null);
		}
	}, [clickedOutside, activeMarkerId, setActiveFollowedTripId]);

	const handleCloseCurrentTrips = useCallback(() => {
		setShowCurrentTrips(false);
		setSelectedStopForSchedule(null);
		setSelectedStopRouteLines(null);
		setActiveStopMarkerId(null);
		setActiveMarkerId(null);
		setActiveFollowedTripId(null);
		setFollowBus(false);
		setClickedOutside(true);
	}, [
		setActiveFollowedTripId,
		setSelectedStopForSchedule,
		setSelectedStopRouteLines,
	]);

	const handleSetCurrentTripsVisibility = useCallback(
		(show: boolean) => {
			if (show) {
				setShowCurrentTrips(true);
				return;
			}
			if (selectedStopForSchedule) {
				setShowCurrentTrips(false);
				return;
			}
			handleCloseCurrentTrips();
		},
		[handleCloseCurrentTrips, selectedStopForSchedule],
	);

	const handleCloseInfoWindow = useCallback(() => {
		setInfoWindowActive(false);
		setScheduleInfoBoardStop(null);
		setActiveFollowedTripId(null);
		setActiveMarkerId(null);
		setFollowBus(false);
		setClickedOutside(true);
	}, [setActiveFollowedTripId]);

	/** Rensa sökfält / linje i URL → stäng paneler som hör till vald linje. */
	useEffect(() => {
		if (linjeParam || selectedStopForSchedule) return;
		handleCloseInfoWindow();
		setShowCurrentTrips(false);
		setActiveStopMarkerId(null);
	}, [handleCloseInfoWindow, linjeParam, selectedStopForSchedule]);

	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		throw new Error("GOOGLE_MAPS_API_KEY is not defined");
	}

	const hasRouteData =
		isPinnedStopMode ||
		filteredVehicles.data.length > 0 ||
		tripData.upcomingTrips.length > 0 ||
		tripData.lineStops.length > 0 ||
		tripData.lineShapes.length > 0;

	return (
		<div className="map-client-root">
			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
				{canMountMap && mapInitialCenter && (
					<GoogleMap
						key={`${mapOperatorForView}:${mapMountKey}`}
						mapId={"fb3dad0c952dfd27"}
						style={{ width: "100vw", height: "100dvh", zIndex: "unset" }}
						defaultZoom={
							linjeParam || mapBootstrapZoomTabState.doneInTab
								? MAP_TARGET_INITIAL_ZOOM
								: MAP_BOOTSTRAP_ZOOM
						}
						minZoom={10}
						defaultCenter={mapInitialCenter}
						gestureHandling={"greedy"}
						onTilesLoaded={(e: MapEvent) => {
							beginVectorMapAttach(e, true);
						}}
						onIdle={(e: MapEvent) => {
							if (!mapReady) {
								beginVectorMapAttach(e, false);
							}
						}}
						onCameraChanged={handleMapCameraChanged}
						disableDefaultUI={true}
						rotateControl={false}
						mapTypeControl={false}
						streetViewControl={false}
						fullscreenControl={false}
						onClick={(e: MapMouseEvent) => {
							if (isClickFromStopUi(e)) return;
							setClickedOutside(true);
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
								setShowCurrentTrips={handleSetCurrentTripsVisibility}
								showCurrentTrips={showCurrentTrips}
								filteredVehicles={visibleVehicleResult}
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
							vehicles={visibleVehicles}
							currentTrips={markerTripRows}
							lineShapes={activeLineShapes}
							mapZoom={mapViewport?.zoom ?? zoomRef.current}
							routeColors={isPinnedStopMode ? stopRouteShapeColors : undefined}
							setInfoWindowActiveExternal={setInfoWindowActive}
							infoWindowActiveExternal={infoWindowActive}
							followBus={followBus}
							setFollowBus={setFollowBus}
							activeMarkerId={activeMarkerId}
							setActiveMarkerId={setActiveMarkerId}
							showCurrentTrips={showCurrentTrips}
						/>
						{infoWindowActive && !activeMarkerId && activeFollowedTripId && (
							<InfoWindow
								tripId={activeFollowedTripId}
								closestStopState={scheduleInfoBoardStop}
								googleMapRef={mapRef}
								onClose={handleCloseInfoWindow}
								style={
									showCurrentTrips && isMobile
										? { display: "none" }
										: { display: "block" }
								}
							/>
						)}
						{mapReady &&
							routeShapes.map(
								(s) =>
									s.points && (
										<RouteShapePolyline
											key={s.shape_id}
											googleMapRef={mapRef}
											shapePoints={s.points}
											mapReady={mapReady}
											strokeColor={
												isPinnedStopMode
													? stopRouteShapeColors.get(s.route_short_name ?? "")
													: undefined
											}
											animateReveal
											animationDuration={1.8}
											hasActiveVehicle={visibleVehicles.length > 0}
											onClick={
												isPinnedStopMode && s.route_short_name
													? () =>
															handleRouteShapeClick(s.route_short_name ?? "")
													: undefined
											}
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
								labelMode={stopMarkersLabels}
								activeStopId={resolveActiveStopMarkerId(
									activeStopMarkerId,
									selectedStopPlatformFilter,
									selectedStopForSchedule?.stop_id,
									showCurrentTrips || selectedStopForSchedule !== null,
								)}
								focusedStationIds={focusedStationIds}
							/>
						)}
						{showCurrentTrips &&
							hasRouteData &&
							(userPosition || selectedStopForSchedule) && (
								<CurrentTrips
									onTripSelect={handleTripSelect}
									onClose={handleCloseCurrentTrips}
									mapRef={mapRef}
									followedTripId={followedTripId ?? fallbackFollowed.tripId}
									closestStop={
										selectedStopForSchedule ??
										userPosition?.closestStop ??
										undefined
									}
								/>
							)}
						{userPosition && mapRef.current && (
							<AdvancedMarker
								title={"Min position"}
								anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
								zIndex={50}
								clickable
								onClick={enableCompassFromUserGesture}
								position={
									new google.maps.LatLng({
										lat: userPosition.lat,
										lng: userPosition.lng,
									})
								}
							>
								<UserLocationMarker
									heading={userPosition.heading}
									mapBearing={mapBearing}
									visible={
										(mapRef.current?.getZoom() ?? 0) >= 12 &&
										!hideUserPositionForZoom
									}
									labelFontSize={(mapRef.current?.getZoom() ?? 10) * 0.8}
								/>
							</AdvancedMarker>
						)}
					</GoogleMap>
				)}
			</APIProvider>
			{(!canMountMap || !mapReady) && (
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
