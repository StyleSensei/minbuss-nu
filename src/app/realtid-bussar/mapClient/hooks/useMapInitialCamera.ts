import { useRouter, useSearchParams } from "next/navigation";
import { type RefObject, useEffect, useRef } from "react";
import { searchPathForOperator } from "../../../paths";
import {
	MAP_BOOTSTRAP_ZOOM,
	MAP_TARGET_INITIAL_ZOOM,
	mapBootstrapZoomTabState,
} from "../mapClientConstants";

export function useInitialLinjeFromDocumentRef() {
	const initialLinjeFromDocumentRef = useRef<string | null>(null);
	if (
		typeof window !== "undefined" &&
		initialLinjeFromDocumentRef.current === null
	) {
		initialLinjeFromDocumentRef.current =
			new URLSearchParams(window.location.search)
				.get("linje")
				?.trim()
				.toUpperCase() ?? "";
	}
	return initialLinjeFromDocumentRef;
}

export function useMapInitialCamera(
	mapReady: boolean,
	mapRef: RefObject<google.maps.Map | null>,
	mapOperatorForView: string,
	operatorDefaultCenter: google.maps.LatLngLiteral,
	linjeParam: string,
	userPosition: { lat: number; lng: number } | null,
	focusUserParam: boolean,
	centerOnUser: boolean,
) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const prevMapOperatorForPanRef = useRef<string | null>(null);
	const userGeolocatePanDoneRef = useRef(false);
	const mapInitialZoomBootstrapDoneRef = useRef(false);

	const lastLineShapeFitKeyRef = useRef<string>("");
	useEffect(() => {
		void linjeParam;
		lastLineShapeFitKeyRef.current = "";
	}, [linjeParam]);

	const prevLinjeParamForUserPanRef = useRef("");
	useEffect(() => {
		prevLinjeParamForUserPanRef.current = linjeParam;
	}, [linjeParam]);

	useEffect(() => {
		if (!mapReady || !mapRef.current) return;
		if (prevMapOperatorForPanRef.current === null) {
			prevMapOperatorForPanRef.current = mapOperatorForView;
			if (linjeParam) return;
			const initialMap = mapRef.current;
			if (centerOnUser && userPosition) {
				initialMap.panTo({
					lat: userPosition.lat,
					lng: userPosition.lng,
				});
				userGeolocatePanDoneRef.current = true;
			} else {
				initialMap.panTo(operatorDefaultCenter);
				initialMap.setZoom(MAP_TARGET_INITIAL_ZOOM);
			}
			return;
		}
		if (prevMapOperatorForPanRef.current === mapOperatorForView) return;
		prevMapOperatorForPanRef.current = mapOperatorForView;
		const map = mapRef.current;
		map.panTo(operatorDefaultCenter);
		map.setZoom(MAP_TARGET_INITIAL_ZOOM);
		userGeolocatePanDoneRef.current = true;
	}, [
		mapReady,
		mapOperatorForView,
		operatorDefaultCenter,
		mapRef,
		userPosition,
		linjeParam,
		centerOnUser,
	]);

	useEffect(() => {
		if (!centerOnUser) return;
		if (!mapReady || !mapRef.current || !userPosition) return;
		if (linjeParam) return;
		if (userGeolocatePanDoneRef.current) return;
		userGeolocatePanDoneRef.current = true;
		mapRef.current.panTo({
			lat: userPosition.lat,
			lng: userPosition.lng,
		});
	}, [mapReady, userPosition, linjeParam, mapRef, centerOnUser]);

	useEffect(() => {
		if (!focusUserParam || !mapReady || !mapRef.current || !userPosition)
			return;
		const map = mapRef.current;
		map.panTo({
			lat: userPosition.lat,
			lng: userPosition.lng,
		});
		if ((map.getZoom() ?? 10) < 14) {
			map.setZoom(14);
		}
		const p = new URLSearchParams(searchParams.toString());
		p.delete("focusUser");
		const qs = p.toString();
		const base = searchPathForOperator(mapOperatorForView);
		router.replace(qs ? `${base}?${qs}` : base);
	}, [
		focusUserParam,
		mapReady,
		userPosition,
		searchParams,
		mapOperatorForView,
		router,
		mapRef,
	]);

	useEffect(() => {
		if (!mapReady || !mapRef.current || linjeParam) return;
		if (mapInitialZoomBootstrapDoneRef.current) return;
		const map = mapRef.current;
		const listener = google.maps.event.addListenerOnce(map, "idle", () => {
			mapInitialZoomBootstrapDoneRef.current = true;
			google.maps.event.trigger(map, "resize");
			if (!mapBootstrapZoomTabState.doneInTab) {
				const z = map.getZoom();
				if (z != null && z <= MAP_BOOTSTRAP_ZOOM) {
					map.setZoom(MAP_TARGET_INITIAL_ZOOM);
				}
				mapBootstrapZoomTabState.doneInTab = true;
			}
		});
		return () => {
			google.maps.event.removeListener(listener);
		};
	}, [mapReady, linjeParam, mapRef]);

	return { lastLineShapeFitKeyRef };
}
