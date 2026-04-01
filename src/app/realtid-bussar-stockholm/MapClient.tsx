"use client";

export const metadata = {
	title: "Se närmaste bussen live i Stockholm",
};

import {
	Map as GoogleMap,
	APIProvider,
	MapControl,
	ControlPosition,
	type MapCameraChangedEvent,
	type MapEvent,
	type MapMouseEvent,
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	RenderingType,
} from "@vis.gl/react-google-maps";

import { useRouter } from "next/navigation";
import { useDataContext } from "../context/DataContext";
import { MapControlButtons } from "../components/MapControlButtons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StopMarkersLayer } from "./StopMarkersLayer";
import {
	filterStopsInViewport,
	type IStopPositionJson,
	type StopsPositionsFile,
} from "./stopPositionsTypes";
import type { IShapes } from "@shared/models/IShapes";
import type { IDbData } from "@shared/models/IDbData";
import { useIsMobile } from "../hooks/useIsMobile";
import { CurrentTrips } from "../components/CurrentTrips";
import UserMessage from "../components/UserMessage";
import VehicleMarkers from "../components/VehicleMarkers";
import RouteShapePolyline from "../components/RouteShapePolyline";
import { Paths } from "../paths";

/** Limits React re-renders + stop marker work during continuous zoom/pan (camera events are very frequent). */
const CAMERA_STATE_THROTTLE_MS = 120;

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

function stopPositionToPlaceholderDb(s: IStopPositionJson): IDbData {
	return {
		trip_id: "",
		shape_id: "",
		route_short_name: "",
		stop_headsign: "",
		stop_id: s.id,
		departure_time: "",
		stop_name: "",
		stop_sequence: 0,
		stop_lat: s.lat,
		stop_lon: s.lon,
		feed_version: "",
	};
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
	} = useDataContext();
	const router = useRouter();
	const mapRef = useRef<google.maps.Map | null>(null);
	const [clickedOutside, setClickedOutside] = useState(false);
	const [zoomWindowLevel, setCurrentWindowZoomLevel] = useState(100);
	const [showCurrentTrips, setShowCurrentTrips] = useState(false);
	const [infoWindowActive, setInfoWindowActive] = useState(false);
	const [followBus, setFollowBus] = useState(false);
	const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
	const [mapReady, setMapReady] = useState(false);
	const [cameraState, setCameraState] = useState<{
		zoom: number;
		bounds: google.maps.LatLngBoundsLiteral;
	} | null>(null);
	const [allStopPositions, setAllStopPositions] = useState<
		IStopPositionJson[] | null
	>(null);
	const isMobile = useIsMobile();
	const zoomRef = useRef<number>(8);
	const cameraThrottleLastEmitRef = useRef(0);
	const cameraThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const pendingCameraRef = useRef<{
		zoom: number;
		bounds: google.maps.LatLngBoundsLiteral;
	} | null>(null);
	const [hideUserPositionForZoom, setHideUserPositionForZoom] = useState(false);
	const hideUserPositionTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const stopPreviewFetchGenRef = useRef(0);

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
			setSelectedStopForSchedule(stop);
			setMapStopPreview(null);
			router.push(
				`${Paths.Search}?linje=${encodeURIComponent(routeShortName)}`,
			);
		},
		[router, setMapStopPreview, setSelectedStopForSchedule],
	);

	const lastRoutePickAtRef = useRef(0);
	const pickRouteFromPreview = useCallback(
		(
			name: string,
			stop: IDbData,
			_source: "click" | "pointerup" | "touchend",
		) => {
			const now = Date.now();
			// Guard against double-fire on some mobile browsers (pointerup + click).
			if (now - lastRoutePickAtRef.current < 350) {
				return;
			}
			lastRoutePickAtRef.current = now;
			handlePreviewLineClick(name, stop);
		},
		[handlePreviewLineClick],
	);

	const handleStopMarkerClick = useCallback(
		async (stop: IStopPositionJson) => {
			const gen = ++stopPreviewFetchGenRef.current;
			setMapStopPreview({
				stop: stopPositionToPlaceholderDb(stop),
				routeShortNames: [],
				routesLoading: true,
			});
			try {
				const res = await fetch(
					`/api/stops/${encodeURIComponent(stop.id)}/routes`,
				);
				if (gen !== stopPreviewFetchGenRef.current) return;
				if (!res.ok) {
					setMapStopPreview(null);
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
				setMapStopPreview({
					stop: {
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
					},
					routeShortNames: data.routes,
					routesLoading: false,
				});
			} catch (e) {
				if (gen !== stopPreviewFetchGenRef.current) return;
				console.error(e);
				setMapStopPreview(null);
			}
		},
		[setMapStopPreview],
	);

	const visibleStopMarkers = useMemo(
		() =>
			filterStopsInViewport(
				allStopPositions,
				cameraState?.zoom ?? 0,
				cameraState?.bounds ?? null,
			),
		[allStopPositions, cameraState],
	);

	const stopMarkersVisible = useMemo(
		() => (cameraState?.zoom ?? 0) >= 16 && !hideUserPositionForZoom,
		[cameraState?.zoom, hideUserPositionForZoom],
	);

	useEffect(() => {
		if (!mapReady) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/stops-positions.json", {
					cache: "force-cache",
				});
				if (!res.ok) {
					return;
				}
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
				if (!cancelled && Array.isArray(data.stops) && data.stops.length > 0) {
					setAllStopPositions(data.stops);
				}
			} catch {
				// ignore missing or invalid static file
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [mapReady]);

	useEffect(() => {
		return () => {
			if (cameraThrottleTimerRef.current) {
				clearTimeout(cameraThrottleTimerRef.current);
				cameraThrottleTimerRef.current = null;
			}
		};
	}, []);

	const handleCameraChanged = useCallback((e: MapCameraChangedEvent) => {
		const detail = e.detail;
		pendingCameraRef.current = {
			zoom: detail.zoom,
			bounds: detail.bounds,
		};
		const now = Date.now();
		const ms = CAMERA_STATE_THROTTLE_MS;

		if (cameraThrottleTimerRef.current) {
			clearTimeout(cameraThrottleTimerRef.current);
			cameraThrottleTimerRef.current = null;
		}

		if (now - cameraThrottleLastEmitRef.current >= ms) {
			cameraThrottleLastEmitRef.current = now;
			setCameraState({
				zoom: detail.zoom,
				bounds: detail.bounds,
			});
		} else {
			cameraThrottleTimerRef.current = setTimeout(
				() => {
					cameraThrottleTimerRef.current = null;
					cameraThrottleLastEmitRef.current = Date.now();
					const p = pendingCameraRef.current;
					if (p) {
						setCameraState({ zoom: p.zoom, bounds: p.bounds });
					}
				},
				ms - (now - cameraThrottleLastEmitRef.current),
			);
		}
	}, []);

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
						setShowCurrentTrips(false);
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
		if (mapRef.current) {
			if (mapRef.current) {
				const listener = google.maps.event.addListener(
					mapRef.current,
					"zoom_changed",
					() => {
						const newZoom = mapRef.current?.getZoom()!;
						if (newZoom !== zoomWindowLevel) {
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
					},
				);

				return () => {
					if (hideUserPositionTimeoutRef.current) {
						clearTimeout(hideUserPositionTimeoutRef.current);
					}
					if (listener) {
						google.maps.event.removeListener(listener);
					}
				};
			}
		}
	}, [zoomWindowLevel]);

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

	const hasRouteData =
		filteredVehicles.data.length > 0 ||
		tripData.upcomingTrips.length > 0 ||
		tripData.lineStops.length > 0 ||
		tripData.lineShapes.length > 0;

	const mapZoom = cameraState?.zoom ?? 16;
	const showMapStopPreview =
		Boolean(mapStopPreview) && mapReady && mapZoom >= 16;

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
					defaultZoom={14}
					minZoom={10}
					defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
					gestureHandling={"greedy"}
					onTilesLoaded={(e: MapEvent) => {
						const map = e.map as google.maps.Map;
						mapRef.current = map;
						setMapReady(true);
						const z = map.getZoom() ?? 10;
						const b = map.getBounds();
						if (b) {
							setCameraState({ zoom: z, bounds: b.toJSON() });
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
							stops={visibleStopMarkers}
							mapRef={mapRef}
							onStopClick={handleStopMarkerClick}
							stopMarkersVisible={stopMarkersVisible}
						/>
					)}
					{showCurrentTrips && hasRouteData && userPosition && (
						<CurrentTrips
							onTripSelect={handleTripSelect}
							mapRef={mapRef}
							closestStop={
								selectedStopForSchedule ??
								userPosition?.closestStop ??
								undefined
							}
						/>
					)}
					{showMapStopPreview && mapStopPreview && (
						<AdvancedMarker
							className="map-stop-preview-marker"
							title={mapStopPreview.stop.stop_name}
							position={
								new google.maps.LatLng({
									lat: mapStopPreview.stop.stop_lat,
									lng: mapStopPreview.stop.stop_lon,
								})
							}
						>
							<div
								className="map-stop-preview"
								onClick={(e) => e.stopPropagation()}
								aria-busy={mapStopPreview.routesLoading === true}
							>
								{mapStopPreview.routesLoading ? (
									<>
										<div
											className="map-stop-preview__title-skeleton"
											aria-hidden
										/>
										<div
											className="map-stop-preview__routes map-stop-preview__routes--loading"
											aria-hidden
										>
											<span className="map-stop-preview__route-chip-skeleton" />
											<span className="map-stop-preview__route-chip-skeleton" />
											<span className="map-stop-preview__route-chip-skeleton" />
										</div>
									</>
								) : (
									<>
										<p className="map-stop-preview__title">
											{mapStopPreview.stop.stop_name}
										</p>
										<div className="map-stop-preview__routes">
											{[...mapStopPreview.routeShortNames]
												.sort((a, b) => a.localeCompare(b, "sv"))
												.map((name) => (
													<button
														key={name}
														type="button"
														className="map-stop-preview__route-btn"
														onPointerUp={(e) => {
															e.stopPropagation();
															pickRouteFromPreview(
																name,
																mapStopPreview.stop,
																"pointerup",
															);
														}}
														onTouchEnd={(e) => {
															e.stopPropagation();
															pickRouteFromPreview(
																name,
																mapStopPreview.stop,
																"touchend",
															);
														}}
														onClick={(e) => {
															e.stopPropagation();
															pickRouteFromPreview(
																name,
																mapStopPreview.stop,
																"click",
															);
														}}
													>
														{name}
													</button>
												))}
										</div>
									</>
								)}
							</div>
						</AdvancedMarker>
					)}
					{userPosition && mapRef.current && (
						<AdvancedMarker
							title={"Min position"}
							anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
							position={
								new google.maps.LatLng({
									lat: userPosition.lat,
									lng: userPosition.lng,
								})
							}
						>
							<div
								className={`user-location ${mapRef.current?.getZoom()! >= 12 && !hideUserPositionForZoom ? "--visible" : ""}`}
							/>
							<div
								className={`user-location__container ${mapRef.current?.getZoom()! >= 12 && !hideUserPositionForZoom ? "--visible" : ""}`}
							>
								<span
									className="user-location__text"
									style={{ fontSize: mapRef.current?.getZoom()! * 0.8 }}
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
