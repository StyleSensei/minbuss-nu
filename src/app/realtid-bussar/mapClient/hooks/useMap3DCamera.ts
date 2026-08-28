import {
	type MutableRefObject,
	useCallback,
	useEffect,
	useState,
} from "react";
import {
	MAP_3D_MIN_ZOOM,
	MAP_3D_TILT_DEGREES,
	MAP_3D_VIEW_ENABLED_KEY,
} from "../mapClientConstants";

function read3DViewEnabledFromSession(): boolean {
	if (typeof window === "undefined") return false;
	return sessionStorage.getItem(MAP_3D_VIEW_ENABLED_KEY) === "1";
}

function apply3DTilt(map: google.maps.Map, enabled: boolean) {
	map.setTilt(enabled ? MAP_3D_TILT_DEGREES : 0);
	if (!enabled) return;
	const zoom = map.getZoom();
	if (zoom != null && zoom < MAP_3D_MIN_ZOOM) {
		map.setZoom(MAP_3D_MIN_ZOOM);
	}
}

export function useMap3DCamera(
	mapReady: boolean,
	mapRef: MutableRefObject<google.maps.Map | null>,
) {
	const [is3DViewEnabled, setIs3DViewEnabled] = useState(
		read3DViewEnabledFromSession,
	);

	useEffect(() => {
		if (!mapReady || !mapRef.current) return;
		const map = mapRef.current;
		map.setOptions({
			tiltInteractionEnabled: true,
			headingInteractionEnabled: true,
		});
		apply3DTilt(map, is3DViewEnabled);
	}, [mapReady, is3DViewEnabled, mapRef]);

	const toggle3DView = useCallback(() => {
		setIs3DViewEnabled((prev) => {
			const next = !prev;
			if (typeof window !== "undefined") {
				sessionStorage.setItem(MAP_3D_VIEW_ENABLED_KEY, next ? "1" : "0");
			}
			if (mapRef.current) {
				apply3DTilt(mapRef.current, next);
			}
			return next;
		});
	}, [mapRef]);

	const resetMapHeading = useCallback(() => {
		mapRef.current?.setHeading(0);
	}, [mapRef]);

	return { is3DViewEnabled, toggle3DView, resetMapHeading };
}
