"use client";

import type { ITripData } from "../context/DataContext";
import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

interface UseSearchBarTripDataCacheParams {
	userInput: string;
	effectiveOperator: string;
	routeExists: boolean;
	vehicleTripIds: string[];
	userClosestStopName?: string;
	selectedStopName?: string;
	setTripData: Dispatch<SetStateAction<ITripData>>;
	fetchDbData: (
		busLine: string,
		operator: string,
		stopName?: string,
		tripIds?: string[],
		mode?: "full" | "meta" | "shapes",
	) => Promise<ITripData>;
}

export function useSearchBarTripDataCache({
	userInput,
	effectiveOperator,
	routeExists,
	vehicleTripIds,
	userClosestStopName,
	selectedStopName,
	setTripData,
	fetchDbData,
}: UseSearchBarTripDataCacheParams) {
	const lineSelectionGenerationRef = useRef(0);
	const tripDataFetchedForLineRef = useRef("");
	const stopSpecificTripDataKeyRef = useRef("");
	const prevNormalizedLineRef = useRef<string | null>(null);
	const vehicleTripIdsRef = useRef(vehicleTripIds);
	vehicleTripIdsRef.current = vehicleTripIds;

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
		const lineFetchKey = lineAtStart;
		const tripIdsForFetch = vehicleTripIdsRef.current;

		const applyTripData = (
			currentTrips: ITripData["currentTrips"],
			lineStops: ITripData["lineStops"],
			lineShapes: ITripData["lineShapes"],
		) => {
			setTripData((prev) => {
				const prevLine = prev.currentTrips[0]?.route_short_name ?? "";
				const keepExistingUpcoming =
					prevLine === lineAtStart || Boolean(scheduleStopName);
				const prevMatchesLine =
					prev.currentTrips.some(
						(trip) => trip.route_short_name === lineAtStart,
					) ||
					prev.lineStops.some(
						(stop) => stop.route_short_name === lineAtStart,
					);
				return {
					currentTrips:
						currentTrips.length > 0
							? currentTrips
							: prevMatchesLine
								? prev.currentTrips
								: [],
					upcomingTrips: keepExistingUpcoming ? prev.upcomingTrips : [],
					lineStops: lineStops?.length
						? lineStops
						: prevMatchesLine
							? prev.lineStops
							: [],
					lineShapes:
						lineShapes.length > 0
							? lineShapes
							: prevMatchesLine
								? prev.lineShapes
								: [],
				};
			});
		};

		if (lineAtStart && tripDataFetchedForLineRef.current !== lineFetchKey) {
			const genWhenFetchStarted = lineSelectionGenerationRef.current;
			const fetchKeyAtStart = lineFetchKey;
			tripDataFetchedForLineRef.current = lineFetchKey;
			try {
				const meta = await fetchDbData(
					lineAtStart,
					effectiveOperator,
					undefined,
					tripIdsForFetch.length ? tripIdsForFetch : undefined,
					"meta",
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
				applyTripData(meta.currentTrips, meta.lineStops, []);

				const shaped = await fetchDbData(
					lineAtStart,
					effectiveOperator,
					undefined,
					tripIdsForFetch.length ? tripIdsForFetch : undefined,
					"shapes",
				);
				if (genWhenFetchStarted !== lineSelectionGenerationRef.current) return;
				if (userInput.trim() !== lineAtStart) return;
				applyTripData(shaped.currentTrips, shaped.lineStops, shaped.lineShapes);
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
		fetchDbData,
		effectiveOperator,
		setTripData,
	]);

	useEffect(() => {
		const shouldFetch =
			Boolean(selectedStopName ?? userClosestStopName) ||
			(Boolean(userInput.trim()) && routeExists);
		if (!shouldFetch) return;
		const timeoutId = window.setTimeout(() => {
			void handleCachedDbData();
		}, 400);
		return () => window.clearTimeout(timeoutId);
	}, [
		selectedStopName,
		userClosestStopName,
		userInput,
		routeExists,
		handleCachedDbData,
	]);

	return { resetGeneration };
}
