"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface Coordinates {
	lat: number;
	lng: number;
}

interface StopRow {
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	routes: string[];
}

interface UseSearchBarUiParams {
	userInput: string;
	effectiveOperator: string;
	allRoutesAsObject: Record<string, boolean>;
	userPosition: Coordinates | null;
	inputRef: RefObject<HTMLInputElement | null>;
	fetchNearbyStops: (
		lat: number,
		lng: number,
		operator: string,
	) => Promise<{ stops: StopRow[] }>;
	fetchStopSearch: (
		query: string,
		operator: string,
	) => Promise<{ stops: StopRow[] }>;
}

function getGeolocationPosition(): Promise<Coordinates | null> {
	return new Promise((resolve) => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			resolve(null);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
			() => resolve(null),
			{ maximumAge: 60000, enableHighAccuracy: false },
		);
	});
}

export function useSearchBarUi({
	userInput,
	effectiveOperator,
	allRoutesAsObject,
	userPosition,
	inputRef,
	fetchNearbyStops,
	fetchStopSearch,
}: UseSearchBarUiParams) {
	const [isTextMode, setIsTextMode] = useState(false);
	const [isKeyboardLikelyOpen, setIsKeyboardLikelyOpen] = useState(false);
	const [isActive, setIsActive] = useState(false);
	const [isBlurring, setIsBlurring] = useState(false);
	const [nearbyStopsList, setNearbyStopsList] = useState<StopRow[]>([]);
	const [stopSearchList, setStopSearchList] = useState<StopRow[]>([]);
	const [nearbyStopsLoading, setNearbyStopsLoading] = useState(false);
	const [stopSearchLoading, setStopSearchLoading] = useState(false);
	const initialHeight = useRef<number | null>(null);

	const handleVisualViewPortResize = useCallback(() => {
		if (!initialHeight.current || !window.visualViewport) return;
		const keyboardOpen = window.innerHeight > window.visualViewport.height + 150;
		setIsKeyboardLikelyOpen(keyboardOpen);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined" || !window.visualViewport) return;
		const vv = window.visualViewport;
		vv.addEventListener("resize", handleVisualViewPortResize);
		return () => vv.removeEventListener("resize", handleVisualViewPortResize);
	}, [handleVisualViewPortResize]);

	const handleBlur = useCallback(() => {
		setIsBlurring(true);
		setTimeout(() => {
			setIsActive(false);
			setIsBlurring(false);
			setIsKeyboardLikelyOpen(false);
		}, 100);
	}, []);

	const handleFocus = useCallback(() => {
		setIsActive(true);
		const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
		if (isMobile) setIsKeyboardLikelyOpen(true);

		void (async () => {
			setNearbyStopsLoading(true);
			const pos =
				userPosition != null
					? { lat: userPosition.lat, lng: userPosition.lng }
					: await getGeolocationPosition();
			if (!pos) {
				setNearbyStopsList([]);
				setNearbyStopsLoading(false);
				return;
			}
			try {
				const { stops } = await fetchNearbyStops(
					pos.lat,
					pos.lng,
					effectiveOperator,
				);
				setNearbyStopsList(stops);
			} catch {
				setNearbyStopsList([]);
			} finally {
				setNearbyStopsLoading(false);
			}
		})();
	}, [effectiveOperator, fetchNearbyStops, userPosition]);

	const handleToggleTextMode = useCallback(() => {
		setIsTextMode((prev) => !prev);
		inputRef.current?.focus();
	}, [inputRef]);

	useEffect(() => {
		const q = userInput.trim();
		if (q.length < 2 || allRoutesAsObject[q.toUpperCase()]) {
			setStopSearchList([]);
			setStopSearchLoading(false);
			return;
		}
		setStopSearchLoading(true);
		let cancelled = false;
		const t = setTimeout(async () => {
			try {
				const { stops } = await fetchStopSearch(q, effectiveOperator);
				if (cancelled) return;
				setStopSearchList(stops);
			} catch {
				if (cancelled) return;
				setStopSearchList([]);
			} finally {
				if (!cancelled) setStopSearchLoading(false);
			}
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(t);
			setStopSearchLoading(false);
		};
	}, [userInput, allRoutesAsObject, effectiveOperator, fetchStopSearch]);

	const clearSuggestions = useCallback(() => {
		setNearbyStopsList([]);
		setStopSearchList([]);
	}, []);

	return {
		isTextMode,
		isKeyboardLikelyOpen,
		isActive,
		isBlurring,
		nearbyStopsList,
		stopSearchList,
		nearbyStopsLoading,
		stopSearchLoading,
		handleFocus,
		handleBlur,
		handleToggleTextMode,
		clearSuggestions,
		setNearbyStopsList,
		setStopSearchList,
	};
}
