"use client";

import type { IDbData } from "@shared/models/IDbData";
import type { IStopBoardShape } from "@shared/models/IStopBoardShape";
import { useEffect, useState } from "react";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";

interface IStopBoardShapesState {
	shapes: IStopBoardShape[];
	isLoading: boolean;
	error: string | null;
}

const EMPTY_STOP_BOARD_SHAPES: IStopBoardShapesState = {
	shapes: [],
	isLoading: false,
	error: null,
};

export function useStopBoardShapes(
	selectedStop: IDbData | null,
	operator: string,
): IStopBoardShapesState {
	const stopId = selectedStop?.stop_id ?? "";
	const [state, setState] = useState<IStopBoardShapesState>(
		EMPTY_STOP_BOARD_SHAPES,
	);

	useEffect(() => {
		if (!stopId) {
			setState(EMPTY_STOP_BOARD_SHAPES);
			return;
		}

		const controller = new AbortController();
		setState({ shapes: [], isLoading: true, error: null });

		const load = async () => {
			try {
				const url = appendOperatorToApiUrl(
					`/api/stops/${encodeURIComponent(stopId)}/shapes`,
					operator,
				);
				const response = await fetch(url, {
					signal: controller.signal,
					cache: "force-cache",
				});
				if (!response.ok) {
					throw new Error(`Shapes request failed: ${response.status}`);
				}
				const data = (await response.json()) as {
					shapes?: IStopBoardShape[];
				};
				if (controller.signal.aborted) return;
				setState({
					shapes: data.shapes ?? [],
					isLoading: false,
					error: null,
				});
			} catch (error) {
				if (controller.signal.aborted) return;
				setState({
					shapes: [],
					isLoading: false,
					error:
						error instanceof Error
							? error.message
							: "Kunde inte hämta linjesträckningar",
				});
			}
		};

		void load();
		return () => controller.abort();
	}, [operator, stopId]);

	return state;
}
