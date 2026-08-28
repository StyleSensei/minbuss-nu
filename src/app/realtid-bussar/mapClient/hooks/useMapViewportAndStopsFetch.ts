import type { MapCameraChangedEvent } from "@vis.gl/react-google-maps";
import {
	startTransition,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { appendOperatorToApiUrl } from "../../../utilities/appendOperatorToApiUrl";
import {
	expandStopQueryBounds,
	filterStopsInViewport,
	type IStopPositionJson,
	STOP_MARKERS_COMPACT_ZOOM,
	STOP_MARKERS_DETAIL_ZOOM,
	STOP_MARKERS_LABEL_ZOOM,
	type StopsPositionsFile,
	snapStopQueryBounds,
} from "../../stopPositionsTypes";
import {
	MAP_STOPS_BOUNDS_EXPAND_RATIO,
	MAP_STOPS_POSITIONS_FETCH_DEBOUNCE_MS,
	MAP_VIEWPORT_DEBOUNCE_MS,
} from "../mapClientConstants";

export function useMapViewportAndStopsFetch(
	mapReady: boolean,
	mapOperatorForView: string,
	operatorRestriction: {
		north: number;
		south: number;
		east: number;
		west: number;
	},
	focusedStationIds: string[] = [],
	focusedStops: IStopPositionJson[] = [],
) {
	const [mapViewport, setMapViewport] = useState<{
		zoom: number;
		bounds: google.maps.LatLngBoundsLiteral;
		heading: number;
	} | null>(null);
	const [allStopPositions, setAllStopPositions] = useState<
		IStopPositionJson[] | null
	>(null);

	const mapViewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const viewportForStops = mapViewport;
	const viewportForStopsRef = useRef(viewportForStops);
	viewportForStopsRef.current = viewportForStops;

	const queueMapViewport = useCallback(
		(
			zoom: number,
			bounds: google.maps.LatLngBoundsLiteral,
			heading: number,
		) => {
			if (mapViewportDebounceRef.current) {
				clearTimeout(mapViewportDebounceRef.current);
				mapViewportDebounceRef.current = null;
			}
			mapViewportDebounceRef.current = setTimeout(() => {
				mapViewportDebounceRef.current = null;
				startTransition(() => {
					setMapViewport({ zoom, bounds, heading });
				});
			}, MAP_VIEWPORT_DEBOUNCE_MS);
		},
		[],
	);

	const stopPositionsWithFocused = useMemo(() => {
		if (focusedStops.length === 0) return allStopPositions;
		const focusedParentIds = new Set(focusedStationIds);
		const byId = new Map<string, IStopPositionJson>();
		for (const stop of allStopPositions ?? []) {
			if (
				(stop.parent && focusedParentIds.has(stop.parent)) ||
				(stop.isParent && focusedParentIds.has(stop.id))
			) {
				continue;
			}
			byId.set(stop.id, stop);
		}
		for (const stop of focusedStops) byId.set(stop.id, stop);
		return [...byId.values()];
	}, [allStopPositions, focusedStationIds, focusedStops]);

	const visibleStopMarkers = useMemo(
		() =>
			filterStopsInViewport(
				stopPositionsWithFocused,
				viewportForStops?.zoom ?? 0,
				viewportForStops?.bounds ?? null,
				focusedStationIds,
			),
		[focusedStationIds, stopPositionsWithFocused, viewportForStops],
	);

	const stopsForStopLayer = useDeferredValue(visibleStopMarkers);

	const zoomForStopUi = viewportForStops?.zoom ?? 0;
	const stopMarkersVisible = useMemo(
		() => zoomForStopUi >= STOP_MARKERS_COMPACT_ZOOM,
		[zoomForStopUi],
	);
	const stopMarkersDetail = useMemo(
		() => zoomForStopUi >= STOP_MARKERS_DETAIL_ZOOM,
		[zoomForStopUi],
	);
	const stopMarkersLabels = useMemo(
		() => zoomForStopUi >= STOP_MARKERS_LABEL_ZOOM,
		[zoomForStopUi],
	);

	const stopFetchBoundsKey = viewportForStops?.bounds
		? `${viewportForStops.bounds.north.toFixed(5)},${viewportForStops.bounds.south.toFixed(5)},${viewportForStops.bounds.east.toFixed(5)},${viewportForStops.bounds.west.toFixed(5)}`
		: null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: clear cached markers when switching operator
	useEffect(() => {
		setAllStopPositions(null);
	}, [mapOperatorForView]);

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
						operatorRestriction,
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
						// cache: "force-cache",
					});
					if (!res.ok || cancelled) return;
					const data = (await res.json()) as StopsPositionsFile;
					if (
						!cancelled &&
						Array.isArray(data.stops) &&
						data.stops.length > 0
					) {
						setAllStopPositions((prev) => {
							if (!prev?.length) return data.stops;
							const m = new Map<string, IStopPositionJson>();
							for (const s of prev) m.set(s.id, s);
							for (const s of data.stops) m.set(s.id, s);
							return Array.from(m.values());
						});
					}
				} catch {
					// Keep last good markers; never fall back to unbounded /api/stops/positions.
					if (cancelled || ctrl.signal.aborted) return;
				}
			})();
		}, MAP_STOPS_POSITIONS_FETCH_DEBOUNCE_MS);

		return () => {
			clearTimeout(debounceTimer);
			cancelled = true;
			fetchCtrl?.abort();
		};
	}, [mapReady, stopFetchBoundsKey, mapOperatorForView, operatorRestriction]);

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
			queueMapViewport(d.zoom, d.bounds, d.heading);
		},
		[queueMapViewport],
	);

	return {
		mapViewport,
		setMapViewport,
		allStopPositions,
		mapViewportDebounceRef,
		queueMapViewport,
		handleCameraChanged,
		visibleStopMarkers,
		stopsForStopLayer,
		stopMarkersVisible,
		stopMarkersDetail,
		stopMarkersLabels,
	};
}
