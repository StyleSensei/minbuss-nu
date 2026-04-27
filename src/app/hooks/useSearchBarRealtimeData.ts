"use client";

import type { ITripUpdate } from "@/shared/models/ITripUpdate";
import type { IVehicleFilterResult } from "@shared/models/IVehiclePosition";
import { useCallback, useEffect, useRef } from "react";
import type { IError } from "../services/cacheHelper";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";
import { debounce } from "../utilities/debounce";
import { isLikelyLineNumberQuery } from "../utilities/searchBarHelpers";
import { type ResponseWithData, usePolling } from "./usePolling";

interface UseSearchBarRealtimeDataParams {
	userInput: string;
	effectiveOperator: string;
	routesLoaded: boolean;
	routeExists: boolean;
	allRoutesAsObject: Record<string, boolean>;
	filteredVehiclesLength: number;
	setIsLoading: (value: boolean) => void;
	setFilteredVehicles: (value: {
		data: IVehicleFilterResult["data"];
		error?: IVehicleFilterResult["error"];
	}) => void;
	setFilteredTripUpdates: (value: ITripUpdate[]) => void;
	setErrorMessage: (value: string | null) => void;
	navigateToValidLineIfUrlDiffers: (
		routeCandidate: string,
		opts?: { mapFit?: boolean },
	) => void;
	setMapStopPreview: (value: null) => void;
	setSelectedStopForSchedule: (value: null) => void;
	setSelectedStopRouteLines: (value: null) => void;
	resetTripDataToEmpty: () => void;
	fetchVehicles: (
		query: string,
		operator: string,
	) => Promise<IVehicleFilterResult>;
	fetchTripUpdates: (
		query: string,
		operator: string,
	) => Promise<ResponseWithData<ITripUpdate, IError>>;
}

export function useSearchBarRealtimeData({
	userInput,
	effectiveOperator,
	routesLoaded,
	routeExists,
	allRoutesAsObject,
	filteredVehiclesLength,
	setIsLoading,
	setFilteredVehicles,
	setFilteredTripUpdates,
	setErrorMessage,
	navigateToValidLineIfUrlDiffers,
	setMapStopPreview,
	setSelectedStopForSchedule,
	setSelectedStopRouteLines,
	resetTripDataToEmpty,
	fetchVehicles,
	fetchTripUpdates,
}: UseSearchBarRealtimeDataParams) {
	const VEHICLE_POLL_INTERVAL_MS = 5000;
	const latestVehicleLineRef = useRef(userInput);
	const handleOnChangeRef = useRef<((query: string) => void) | null>(null);

	useEffect(() => {
		latestVehicleLineRef.current = userInput;
	}, [userInput]);

	useEffect(() => {
		if (!routesLoaded) return;
		handleOnChangeRef.current = debounce(async (query: string) => {
			try {
				setIsLoading(true);
				const exists = !!allRoutesAsObject[query.trim().toUpperCase()];
				if (!exists) {
					setIsLoading(false);
					return;
				}

				const result = await fetchVehicles(query, effectiveOperator);
				if (query !== latestVehicleLineRef.current) return;

				setFilteredVehicles({ data: result.data, error: result.error });
				navigateToValidLineIfUrlDiffers(query.trim().toUpperCase(), {
					mapFit: true,
				});

				if (result.error) {
					setErrorMessage(result.error.message);
				}
			} catch {
				// keep previous behavior: only stop loading + show error state
			} finally {
				setIsLoading(false);
			}
		}, 500);
	}, [
		routesLoaded,
		allRoutesAsObject,
		fetchVehicles,
		effectiveOperator,
		setFilteredVehicles,
		setIsLoading,
		setErrorMessage,
		navigateToValidLineIfUrlDiffers,
	]);

	const runLineQuery = useCallback((query: string) => {
		handleOnChangeRef.current?.(query);
	}, []);

	const fetchVehiclesForPolling = useCallback(
		async (query: string, signal?: AbortSignal) => {
			const path = appendOperatorToApiUrl(
				`/api/vehicles/${encodeURIComponent(query)}`,
				effectiveOperator,
			);
			const res = await fetch(path, { signal });
			if (!res.ok) {
				throw new Error(`Request failed: ${res.status} ${res.statusText}`);
			}
			return (await res.json()) as IVehicleFilterResult;
		},
		[effectiveOperator],
	);

	const fetchTripUpdatesForPolling = useCallback(
		async (query: string, _signal?: AbortSignal) => {
			return fetchTripUpdates(query, effectiveOperator);
		},
		[effectiveOperator, fetchTripUpdates],
	);

	const onTripUpdatesPollData = useCallback(
		(response: ResponseWithData<ITripUpdate, IError>) => {
			if (response?.data) setFilteredTripUpdates(response.data);
		},
		[setFilteredTripUpdates],
	);

	const { startPolling: pollVehiclePositions, stopPolling: stopVehiclePolling } =
		usePolling<IVehicleFilterResult>(
			fetchVehiclesForPolling,
			setFilteredVehicles,
			VEHICLE_POLL_INTERVAL_MS,
			{
				onError: () =>
					setFilteredVehicles({
						data: [],
						error: { type: "OTHER", message: "Polling failed" },
					}),
			},
		);

	const { startPolling: pollTripUpdates, stopPolling: stopPollingUpdates } =
		usePolling<ResponseWithData<ITripUpdate, IError>>(
			fetchTripUpdatesForPolling,
			onTripUpdatesPollData,
			20000,
		);

	const isTripUpdatesPollingActive = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: preserves prior flow
	useEffect(() => {
		const trimmedUi = userInput.trim();
		if (
			trimmedUi &&
			!routeExists &&
			isLikelyLineNumberQuery(trimmedUi) &&
			filteredVehiclesLength > 0
		) {
			setFilteredVehicles({ data: [] });
			setFilteredTripUpdates([]);
			resetTripDataToEmpty();
			return;
		}
		if (userInput && !routeExists) return;

		if (!userInput && filteredVehiclesLength) {
			setFilteredVehicles({ data: [] });
			resetTripDataToEmpty();
			setFilteredTripUpdates([]);
			setMapStopPreview(null);
			setSelectedStopForSchedule(null);
			setSelectedStopRouteLines(null);
			return;
		}
		if (!userInput) {
			resetTripDataToEmpty();
			setFilteredTripUpdates([]);
			setMapStopPreview(null);
			setSelectedStopForSchedule(null);
			setSelectedStopRouteLines(null);
			return;
		}

		if (routeExists) {
			pollVehiclePositions(userInput);
			if (!isTripUpdatesPollingActive.current) {
				isTripUpdatesPollingActive.current = true;
				void (async () => {
					try {
						const response = await fetchTripUpdates(userInput, effectiveOperator);
						if (response?.data) setFilteredTripUpdates(response.data);
					} catch {
						// ignore, polling loop continues
					}
				})();
				pollTripUpdates(userInput);
			}
		}

		return () => {
			stopVehiclePolling();
			if (isTripUpdatesPollingActive.current) {
				stopPollingUpdates();
				isTripUpdatesPollingActive.current = false;
			}
		};
	}, [
		userInput,
		filteredVehiclesLength,
		routeExists,
		effectiveOperator,
		pollVehiclePositions,
		pollTripUpdates,
		stopVehiclePolling,
		stopPollingUpdates,
		setFilteredTripUpdates,
		resetTripDataToEmpty,
		setFilteredVehicles,
		setMapStopPreview,
		setSelectedStopForSchedule,
		setSelectedStopRouteLines,
		fetchTripUpdates,
	]);

	return { runLineQuery, latestVehicleLineRef };
}
