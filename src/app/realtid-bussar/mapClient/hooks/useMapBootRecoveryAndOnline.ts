import { type RefObject, useEffect, useRef } from "react";
import { MAP_BOOT_HARD_RELOAD_COUNT_KEY } from "../mapClientConstants";

export function useMapBootRecoveryAndOnline(
	mapOperatorForView: string,
	clearVectorPaintIdleWatchers: () => void,
	mapReady: boolean,
	mapMountKey: number,
	setMapMountKey: (fn: (prev: number) => number) => void,
	mapRef: RefObject<google.maps.Map | null>,
	setMapReady: (v: boolean) => void,
	setMapViewport: (
		v: {
			zoom: number;
			bounds: google.maps.LatLngBoundsLiteral;
		} | null,
	) => void,
) {
	const mapBootRecoveryAttemptsRef = useRef(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: must reset map when operator changes; primitives in deps are intentional
	useEffect(() => {
		clearVectorPaintIdleWatchers();
		mapBootRecoveryAttemptsRef.current = 0;
		setMapReady(false);
		mapRef.current = null;
		setMapViewport(null);
	}, [
		mapOperatorForView,
		clearVectorPaintIdleWatchers,
		mapRef,
		setMapReady,
		setMapViewport,
	]);

	useEffect(() => {
		void mapMountKey;
		if (mapReady) {
			mapBootRecoveryAttemptsRef.current = 0;
			return;
		}
		if (mapBootRecoveryAttemptsRef.current >= 2) {
			const hardReloads = Number(
				sessionStorage.getItem(MAP_BOOT_HARD_RELOAD_COUNT_KEY) ?? "0",
			);
			if (hardReloads < 1) {
				sessionStorage.setItem(
					MAP_BOOT_HARD_RELOAD_COUNT_KEY,
					String(hardReloads + 1),
				);
				window.location.reload();
			}
			return;
		}
		const timer = setTimeout(() => {
			if (mapReady || mapBootRecoveryAttemptsRef.current >= 2) {
				return;
			}
			mapBootRecoveryAttemptsRef.current += 1;
			clearVectorPaintIdleWatchers();
			mapRef.current = null;
			setMapViewport(null);
			setMapMountKey((prev) => prev + 1);
		}, 9000);

		return () => clearTimeout(timer);
	}, [
		mapReady,
		mapMountKey,
		clearVectorPaintIdleWatchers,
		mapRef,
		setMapViewport,
		setMapMountKey,
	]);

	useEffect(() => {
		if (mapReady && typeof window !== "undefined") {
			sessionStorage.removeItem(MAP_BOOT_HARD_RELOAD_COUNT_KEY);
		}
	}, [mapReady]);

	useEffect(() => {
		const handleOnline = () => {
			if (mapReady) return;
			setMapMountKey((prev) => prev + 1);
		};
		window.addEventListener("online", handleOnline);
		return () => {
			window.removeEventListener("online", handleOnline);
		};
	}, [mapReady, setMapMountKey]);
}
