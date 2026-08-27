import type { IDbData } from "@shared/models/IDbData";
import { type MutableRefObject, useEffect } from "react";
import type { IMapStopPreview } from "../../../context/DataContext";

export function useMapStopCameraPans(
	mapReady: boolean,
	mapRef: MutableRefObject<google.maps.Map | null>,
	mapStopPreview: IMapStopPreview | null,
	selectedStopForSchedule: IDbData | null,
	mapStopPanRequestIdRef: MutableRefObject<string | null>,
) {
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
	}, [mapStopPreview, mapReady, mapRef]);

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
	}, [mapReady, selectedStopForSchedule, mapRef, mapStopPanRequestIdRef]);
}
