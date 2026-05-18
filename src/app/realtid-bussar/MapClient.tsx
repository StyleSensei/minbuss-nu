"use client";

import type { IDbData } from "@shared/models/IDbData";
import {
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	APIProvider,
	ControlPosition,
	Map as GoogleMap,
	MapControl,
	type MapEvent,
	type MapMouseEvent,
	RenderingType,
} from "@vis.gl/react-google-maps";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useAutoOpenCurrentTrips } from "./mapClient/hooks/useAutoOpenCurrentTrips";
import { useEndFollowOnUserGesture } from "./mapClient/hooks/useEndFollowOnUserGesture";
import { useFollowBusBorderClass } from "./mapClient/hooks/useFollowBusBorderClass";
import { useHideUserMarkerDuringZoom } from "./mapClient/hooks/useHideUserMarkerDuringZoom";
import { useLandingChromeHide } from "./mapClient/hooks/useLandingChromeHide";
import { useLineShapeFitBounds } from "./mapClient/hooks/useLineShapeFitBounds";
import { useMapBootRecoveryAndOnline } from "./mapClient/hooks/useMapBootRecoveryAndOnline";
import { useInitialRegionFromGeo } from "./mapClient/hooks/useInitialRegionFromGeo";
import { useMapInitialCenter } from "./mapClient/hooks/useMapInitialCenter";
import { hrefForOperatorAtUserPosition } from "./mapClient/mapClientRegionNavigation";
import {
	useInitialLinjeFromDocumentRef,
	useMapInitialCamera,
} from "./mapClient/hooks/useMapInitialCamera";
import { useMapOperatorResolution } from "./mapClient/hooks/useMapOperatorResolution";
import { useMapStopCameraPans } from "./mapClient/hooks/useMapStopCameraPans";
import { useMapVectorReady } from "./mapClient/hooks/useMapVectorReady";
import { useMapViewportAndStopsFetch } from "./mapClient/hooks/useMapViewportAndStopsFetch";
import { useMobileInfoWindowCollapsesTrips } from "./mapClient/hooks/useMobileInfoWindowCollapsesTrips";
import { useOperatorsMeta } from "./mapClient/hooks/useOperatorsMeta";
import { useRouteShapesForMap } from "./mapClient/hooks/useRouteShapesForMap";
import { useSyncCurrentTripsOpenToContext } from "./mapClient/hooks/useSyncCurrentTripsOpenToContext";
import { useSyncTripsIntoUserPosition } from "./mapClient/hooks/useSyncTripsIntoUserPosition";
import { useWindowZoomPercent } from "./mapClient/hooks/useWindowZoomPercent";
import {
	MAP_BOOTSTRAP_ZOOM,
	MAP_TARGET_INITIAL_ZOOM,
	mapBootstrapZoomTabState,
} from "./mapClient/mapClientConstants";
import { isClickFromStopUi } from "./mapClient/mapClientStopUi";
import { StopMarkersLayer } from "./StopMarkersLayer";
import {
	type IStopPositionJson,
	STOP_MARKERS_DETAIL_ZOOM,
} from "./stopPositionsTypes";

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
	} = useDataContext();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const mapRef = useRef<google.maps.Map | null>(null);
	const zoomRef = useRef<number>(8);
	const [clickedOutside, setClickedOutside] = useState(false);
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
		selectedStopForSchedule,
		userPosition?.closestStop,
		filteredVehicles.data,
		tripData.currentTrips,
		tripData.upcomingTrips,
	]);
	const [mapReady, setMapReady] = useState(false);
	const [mapMountKey, setMapMountKey] = useState(0);
	const isMobile = useIsMobile();
	const stopPreviewFetchGenRef = useRef(0);
	const mapStopPanRequestIdRef = useRef<string | null>(null);

	const linjeParam = searchParams.get("linje")?.trim().toUpperCase() ?? "";
	const operatorUrlParam = searchParams.get("operator")?.trim() ?? "";
	const mapFitParam = searchParams.get("mapfit") === "1";
	const focusUserParam = searchParams.get("focusUser") === "1";

	const operatorSlugFromPath = useMemo(
		() => parseOperatorFromRealtimePathname(pathname),
		[pathname],
	);

	const operatorsMeta = useOperatorsMeta();
	const {
		mapOperatorForView,
		operatorMapView,
		findOperatorForPosition,
		searchHrefWithLinje,
	} = useMapOperatorResolution(
		operatorsMeta,
		operatorSlugFromPath,
		operatorUrlParam,
	);

	const hideUserPositionForZoom = useHideUserMarkerDuringZoom(
		mapReady,
		mapRef,
		zoomRef,
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
	} = useMapViewportAndStopsFetch(
		mapReady,
		mapOperatorForView,
		operatorMapView.restriction,
		hideUserPositionForZoom,
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

	const initialLinjeFromDocumentRef = useInitialLinjeFromDocumentRef();
	const { lastLineShapeFitKeyRef } = useMapInitialCamera(
		mapReady,
		mapRef,
		mapOperatorForView,
		operatorMapView.defaultCenter,
		linjeParam,
		userPosition,
		focusUserParam,
	);

	useLandingChromeHide();
	useFollowBusBorderClass(followBus, filteredVehicles.data.length);
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
		mapStopPreview,
		selectedStopForSchedule,
		mapStopPanRequestIdRef,
	);

	useAutoOpenCurrentTrips(selectedStopForSchedule, setShowCurrentTrips);
	useMobileInfoWindowCollapsesTrips(
		isMobile,
		infoWindowActive,
		setShowCurrentTrips,
	);

	useWindowZoomPercent();

	const { routeShapes, lineShapesForFit } = useRouteShapesForMap(
		filteredVehicles.data,
		tripData.lineShapes,
	);

	useLineShapeFitBounds(
		mapReady,
		mapRef,
		linjeParam,
		lineShapesForFit,
		routeShapes,
		mapFitParam,
		mapOperatorForView,
		initialLinjeFromDocumentRef,
		lastLineShapeFitKeyRef,
		setFollowBus,
	);

	useSyncCurrentTripsOpenToContext(showCurrentTrips, setIsCurrentTripsOpen);

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
		linjeParam,
	);
	const canMountMap = regionResolved && mapMountReady && mapInitialCenter != null;
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
			router.push(
				hrefForOperatorAtUserPosition(matchedOperator, searchParams),
			);
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
					mapRef.current?.setZoom(17);
					if (isMobile) {
						setShowCurrentTrips(false);
					}
				}, 50);
			}
		},
		[filteredVehicles, isMobile],
	);

	if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
		throw new Error("GOOGLE_MAPS_API_KEY is not defined");
	}

	const hasRouteData =
		filteredVehicles.data.length > 0 ||
		tripData.upcomingTrips.length > 0 ||
		tripData.lineStops.length > 0 ||
		tripData.lineShapes.length > 0;

	const mapZoom = mapViewport?.zoom ?? MAP_TARGET_INITIAL_ZOOM;
	const showMapStopPreview =
		Boolean(mapStopPreview) && mapReady && mapZoom >= STOP_MARKERS_DETAIL_ZOOM;

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
