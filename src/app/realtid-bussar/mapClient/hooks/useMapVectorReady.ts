import type { MapEvent } from "@vis.gl/react-google-maps";
import {
	type MutableRefObject,
	startTransition,
	useCallback,
	useEffect,
	useRef,
} from "react";
import {
	MAP_VECTOR_PAINT_IDLE_DEBOUNCE_MS,
	MAP_VECTOR_PAINT_POST_TILES_MIN_MS,
} from "../mapClientConstants";

type MapViewportDebounceRef = MutableRefObject<ReturnType<
	typeof setTimeout
> | null>;

export function useMapVectorReady(
	mapRef: MutableRefObject<google.maps.Map | null>,
	zoomRef: MutableRefObject<number>,
	mapViewportDebounceRef: MapViewportDebounceRef,
	setMapReady: (v: boolean) => void,
	setMapViewport: (
		v: {
			zoom: number;
			bounds: google.maps.LatLngBoundsLiteral;
		} | null,
	) => void,
) {
	const vectorPaintIdleListenerRef =
		useRef<google.maps.MapsEventListener | null>(null);
	const tilesLoadedFallbackListenerRef =
		useRef<google.maps.MapsEventListener | null>(null);
	const vectorPaintDebounceTimerRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const vectorTilesLoadedGateRef = useRef(false);
	const vectorFirstTilesLoadedAtRef = useRef<number | null>(null);

	const clearVectorPaintIdleWatchers = useCallback(() => {
		vectorTilesLoadedGateRef.current = false;
		vectorFirstTilesLoadedAtRef.current = null;
		if (vectorPaintDebounceTimerRef.current) {
			clearTimeout(vectorPaintDebounceTimerRef.current);
			vectorPaintDebounceTimerRef.current = null;
		}
		if (vectorPaintIdleListenerRef.current && typeof google !== "undefined") {
			google.maps.event.removeListener(vectorPaintIdleListenerRef.current);
			vectorPaintIdleListenerRef.current = null;
		}
		if (
			tilesLoadedFallbackListenerRef.current &&
			typeof google !== "undefined"
		) {
			google.maps.event.removeListener(tilesLoadedFallbackListenerRef.current);
			tilesLoadedFallbackListenerRef.current = null;
		}
	}, []);

	const beginVectorMapAttachRef = useRef<
		(e: MapEvent, fromTilesLoaded: boolean) => void
	>(() => {});

	const beginVectorMapAttach = useCallback(
		(e: MapEvent, fromTilesLoaded: boolean) => {
			const map = e.map as google.maps.Map;
			mapRef.current = map;
			const z = map.getZoom() ?? 10;
			const b = map.getBounds();
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
				const sinceTiles = t0 === null ? 0 : Date.now() - t0;
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
				if (!tilesLoadedFallbackListenerRef.current) {
					tilesLoadedFallbackListenerRef.current =
						google.maps.event.addListenerOnce(map, "tilesloaded", () => {
							tilesLoadedFallbackListenerRef.current = null;
							beginVectorMapAttachRef.current({ map } as MapEvent, true);
						});
				}
			}

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

			if (fromTilesLoaded) {
				scheduleVectorPaintReady();
			}
		},
		[
			clearVectorPaintIdleWatchers,
			mapRef,
			mapViewportDebounceRef,
			setMapReady,
			setMapViewport,
			zoomRef,
		],
	);

	beginVectorMapAttachRef.current = beginVectorMapAttach;

	useEffect(() => {
		return () => {
			clearVectorPaintIdleWatchers();
		};
	}, [clearVectorPaintIdleWatchers]);

	return { clearVectorPaintIdleWatchers, beginVectorMapAttach };
}
