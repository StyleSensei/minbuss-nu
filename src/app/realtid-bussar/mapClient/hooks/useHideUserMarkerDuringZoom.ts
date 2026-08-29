import { type RefObject, useEffect, useRef, useState } from "react";

export function useHideUserMarkerDuringZoom(
	mapReady: boolean,
	mapRef: RefObject<google.maps.Map | null>,
	zoomRef: RefObject<number>,
) {
	const [hideUserPositionForZoom, setHideUserPositionForZoom] = useState(false);
	const hideUserPositionTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);

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
	}, [mapReady, mapRef, zoomRef]);

	return hideUserPositionForZoom;
}
