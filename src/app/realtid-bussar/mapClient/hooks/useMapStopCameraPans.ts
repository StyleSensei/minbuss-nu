import type { IDbData } from "@shared/models/IDbData";
import { type RefObject, useEffect, useRef } from "react";
import type { IStopPositionJson } from "../../stopPositionsTypes";

export function useMapStopCameraPans(
	mapReady: boolean,
	mapRef: RefObject<google.maps.Map | null>,
	selectedStopForSchedule: IDbData | null,
	focusedStationStops: IStopPositionJson[] = [],
) {
	const lastCameraKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !selectedStopForSchedule) return;
		const cameraKey = `${selectedStopForSchedule.stop_id}:${focusedStationStops
			.map((stop) => `${stop.id}:${stop.lat}:${stop.lon}`)
			.sort()
			.join("|")}`;
		if (lastCameraKeyRef.current === cameraKey) return;
		lastCameraKeyRef.current = cameraKey;

		if (focusedStationStops.length > 1) {
			const bounds = new google.maps.LatLngBounds();
			for (const stop of focusedStationStops) {
				bounds.extend({ lat: stop.lat, lng: stop.lon });
			}
			mapRef.current.fitBounds(bounds, 64);
			return;
		}
		mapRef.current.panTo({
			lat: selectedStopForSchedule.stop_lat,
			lng: selectedStopForSchedule.stop_lon,
		});
		const z = mapRef.current.getZoom() ?? 10;
		if (z < 18) {
			mapRef.current.setZoom(18);
		}
	}, [focusedStationStops, mapReady, selectedStopForSchedule, mapRef]);
}
