"use client";

import type { IDbData } from "@shared/models/IDbData";
import type { IStopBoardShape } from "@shared/models/IStopBoardShape";
import { useEffect, useState } from "react";
import { appendOperatorToApiUrl } from "../utilities/appendOperatorToApiUrl";
import {
	mergeStreamedStopBoardShape,
	parseStopBoardShapeStreamEvent,
	stopBoardShapesFromRefs,
} from "../utilities/stopBoardShapeStream";

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

async function readNdjsonEvents(
	body: ReadableStream<Uint8Array>,
	onEvent: (event: ReturnType<typeof parseStopBoardShapeStreamEvent>) => void,
) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			onEvent(parseStopBoardShapeStreamEvent(line));
		}
	}
	if (buffer.trim()) {
		onEvent(parseStopBoardShapeStreamEvent(buffer));
	}
}

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
					`/api/stops/${encodeURIComponent(stopId)}/shapes?v=12`,
					operator,
				);
				const response = await fetch(url, {
					signal: controller.signal,
					cache: "default",
				});
				if (!response.ok) {
					throw new Error(`Shapes request failed: ${response.status}`);
				}
				const contentType = response.headers.get("content-type") ?? "";
				if (contentType.includes("ndjson")) {
					if (!response.body) {
						throw new Error("Shapes stream missing body");
					}
					let shapes: IStopBoardShape[] = [];
					await readNdjsonEvents(response.body, (event) => {
						if (controller.signal.aborted || !event) return;
						if (event.type === "refs") {
							shapes = stopBoardShapesFromRefs(event.refs);
							setState({ shapes, isLoading: true, error: null });
							return;
						}
						if (event.type === "shape") {
							shapes = mergeStreamedStopBoardShape(shapes, event.shape);
							setState({ shapes, isLoading: true, error: null });
							return;
						}
						if (event.type === "done") {
							setState({ shapes, isLoading: false, error: null });
						}
					});
					if (controller.signal.aborted) return;
					setState((current) =>
						current.isLoading ? { ...current, isLoading: false } : current,
					);
					return;
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
