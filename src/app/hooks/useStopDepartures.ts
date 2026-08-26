"use client";

import type { IDbData } from "@shared/models/IDbData";
import type { IStopBoardChild } from "@shared/models/IStopBoardStation";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { useEffect } from "react";
import {
	EMPTY_STOP_BOARD_DATA,
	type IStopBoardData,
	useDataContext,
} from "../context/DataContext";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";

interface StopDeparturesResponse {
	stationStopId: string;
	stationStopIds: string[];
	children: IStopBoardChild[];
	departures: IDbData[];
	tripUpdates: ITripUpdate[];
	activeTripIds: string[];
	vehicles: IVehiclePosition[];
	routes: string[];
}

const STOP_DEPARTURES_POLL_INTERVAL_MS = 10000;

export function useStopDepartures(
	selectedStop: IDbData | null,
	operator: string,
) {
	const {
		setStopBoardData,
		setSelectedStopLineFilter,
		setSelectedStopModeFilter,
		setSelectedStopPlatformFilter,
	} = useDataContext();
	const stopId = selectedStop?.stop_id ?? "";

	useEffect(() => {
		if (!stopId) {
			setStopBoardData(EMPTY_STOP_BOARD_DATA);
			setSelectedStopLineFilter(null);
			setSelectedStopModeFilter(null);
			setSelectedStopPlatformFilter(null);
			return;
		}
		setSelectedStopLineFilter(null);

		let cancelled = false;
		let activeController: AbortController | null = null;

		const load = async (showLoading: boolean) => {
			activeController?.abort();
			const controller = new AbortController();
			activeController = controller;
			if (showLoading) {
				setStopBoardData({
					...EMPTY_STOP_BOARD_DATA,
					isLoading: true,
				});
			}

			try {
				const url = appendOperatorToApiUrl(
					`/api/stops/${encodeURIComponent(stopId)}/departures`,
					operator,
				);
				const response = await fetch(url, {
					signal: controller.signal,
					cache: "no-store",
				});
				if (!response.ok) {
					throw new Error(`Departures request failed: ${response.status}`);
				}
				const data = (await response.json()) as StopDeparturesResponse;
				if (cancelled || controller.signal.aborted) return;
				const next: IStopBoardData = {
					stationStopId: data.stationStopId ?? stopId,
					stationStopIds: data.stationStopIds ?? [data.stationStopId ?? stopId],
					children: data.children ?? [],
					departures: data.departures ?? [],
					tripUpdates: data.tripUpdates ?? [],
					activeTripIds: data.activeTripIds ?? [],
					vehicles: data.vehicles ?? [],
					routes: data.routes ?? [],
					isLoading: false,
					error: null,
				};
				setStopBoardData(next);
			} catch (error) {
				if (cancelled || controller.signal.aborted) return;
				setStopBoardData((prev) => ({
					...prev,
					isLoading: false,
					error:
						error instanceof Error
							? error.message
							: "Kunde inte hämta avgångar",
				}));
			}
		};

		void load(true);
		const intervalId = window.setInterval(
			() => void load(false),
			STOP_DEPARTURES_POLL_INTERVAL_MS,
		);

		return () => {
			cancelled = true;
			activeController?.abort();
			window.clearInterval(intervalId);
		};
	}, [
		operator,
		setSelectedStopLineFilter,
		setSelectedStopModeFilter,
		setSelectedStopPlatformFilter,
		setStopBoardData,
		stopId,
	]);
}
