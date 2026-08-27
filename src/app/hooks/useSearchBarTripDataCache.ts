"use client";

import type { ITripData } from "../context/DataContext";
import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

interface UseSearchBarTripDataCacheParams {
	userInput: string;
	effectiveOperator: string;
	routeExists: boolean;
	filteredVehiclesLength: number;
	userClosestStopName?: string;
	selectedStopName?: string;
	setTripData: Dispatch<SetStateAction<ITripData>>;
	fetchDbData: (
		busLine: string,
		operator: string,
		stopName?: string,
	) => Promise<ITripData>;
}

export function useSearchBarTripDataCache({
	userInput,
	effectiveOperator,
	routeExists,
	filteredVehiclesLength,
	userClosestStopName,
	selectedStopName,
	setTripData,
	fetchDbData,
}: UseSearchBarTripDataCacheParams) {
	const lineSelectionGenerationRef = useRef(0);
	const tripDataFetchedForLineRef = useRef("");
	const stopSpecificTripDataKeyRef = useRef("");
	const prevNormalizedLineRef = useRef<string | null>(null);

	const resetGeneration = useCallback(() => {
		lineSelectionGenerationRef.current += 1;
		tripDataFetchedForLineRef.current = "";
		stopSpecificTripDataKeyRef.current = "";
	}, []);

	useEffect(() => {
		const normalized = userInput.trim().toUpperCase();
		if (normalized === prevNormalizedLineRef.current) return;
		prevNormalizedLineRef.current = normalized;
		resetGeneration();
	}, [userInput, resetGeneration]);

	const handleCachedDbData = useCallback(async () => {
		const scheduleStopName = selectedStopName ?? userClosestStopName;
		const lineAtStart = userInput.trim();
		const lineFetchKey = lineAtStart
			? `${lineAtStart}|${filteredVehiclesLength > 0 ? "active" : "idle"}`
			: "";

		if (lineAtStart && tripDataFetchedForLineRef.current !== lineFetchKey) {
			const genWhenFetchStarted = lineSelectionGenerationRef.current;
			const fetchKeyAtStart = lineFetchKey;
			tripDataFetchedForLineRef.current = lineFetchKey;
			try {
				const { currentTrips, lineStops, lineShapes } = await fetchDbData(
					lineAtStart,
					effectiveOperator,
				);
				if (genWhenFetchStarted !== lineSelectionGenerationRef.current) {
					if (tripDataFetchedForLineRef.current === fetchKeyAtStart) {
						tripDataFetchedForLineRef.current = "";
					}
					return;
				}
				if (userInput.trim() !== lineAtStart) {
					if (tripDataFetchedForLineRef.current === fetchKeyAtStart) {
						tripDataFetchedForLineRef.current = "";
					}
					return;
				}
				if (tripDataFetchedForLineRef.current !== fetchKeyAtStart) {
					return;
				}
				setTripData((prev) => {
					const prevLine = prev.currentTrips[0]?.route_short_name ?? "";
					const keepExistingUpcoming =
						prevLine === lineAtStart || Boolean(scheduleStopName);
					return {
						currentTrips,
						upcomingTrips: keepExistingUpcoming ? prev.upcomingTrips : [],
						lineStops: lineStops ?? [],
						lineShapes: lineShapes ?? [],
					};
				});
			} catch {
				tripDataFetchedForLineRef.current = "";
			}
		}

		const stopKey =
			scheduleStopName && lineAtStart ? `${lineAtStart}|${scheduleStopName}` : "";
		if (stopKey && stopSpecificTripDataKeyRef.current !== stopKey) {
			const genWhenStopFetchStarted = lineSelectionGenerationRef.current;
			try {
				const { upcomingTrips, lineShapes } = await fetchDbData(
					lineAtStart,
					effectiveOperator,
					scheduleStopName,
				);
				if (genWhenStopFetchStarted !== lineSelectionGenerationRef.current) return;
				if (userInput.trim() !== lineAtStart) return;
				setTripData((prev) => ({
					...prev,
					upcomingTrips: upcomingTrips ?? [],
					lineShapes: lineShapes?.length ? lineShapes : prev.lineShapes,
				}));
				stopSpecificTripDataKeyRef.current = stopKey;
			} catch {
				// ignore and keep previous cached data
			}
		}
	}, [
		selectedStopName,
		userClosestStopName,
		userInput,
		filteredVehiclesLength,
		fetchDbData,
		effectiveOperator,
		setTripData,
	]);

	useEffect(() => {
		const shouldFetch =
			Boolean(selectedStopName ?? userClosestStopName) ||
			Boolean(filteredVehiclesLength) ||
			(Boolean(userInput.trim()) && routeExists);
		if (shouldFetch) {
			void handleCachedDbData();
		}
	}, [
		selectedStopName,
		userClosestStopName,
		filteredVehiclesLength,
		userInput,
		routeExists,
		handleCachedDbData,
	]);

	return { resetGeneration };
}
