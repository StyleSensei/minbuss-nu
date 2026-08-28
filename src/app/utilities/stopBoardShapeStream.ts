import type { IStopBoardShape } from "@shared/models/IStopBoardShape";
import {
	expandStopBoardShapes,
	type ICompactStopBoardShape,
} from "./compactStopBoardShapes";

export interface IStopBoardShapeStreamRef {
	route_short_name: string;
	route_type: number | null;
	shape_id: string;
}

export type StopBoardShapeStreamEvent =
	| { type: "refs"; refs: IStopBoardShapeStreamRef[] }
	| { type: "shape"; shape: ICompactStopBoardShape }
	| { type: "done" };

export function stopBoardShapesFromRefs(
	refs: IStopBoardShapeStreamRef[],
): IStopBoardShape[] {
	return refs
		.filter((ref) => Boolean(ref.shape_id))
		.map((ref) => ({
			route_short_name: ref.route_short_name,
			route_type: ref.route_type,
			shape_id: ref.shape_id,
			points: [],
		}));
}

export function mergeStreamedStopBoardShape(
	shapes: IStopBoardShape[],
	compact: ICompactStopBoardShape,
): IStopBoardShape[] {
	const [expanded] = expandStopBoardShapes([compact]);
	if (!expanded?.shape_id) return shapes;
	let replaced = false;
	const next = shapes.map((shape) => {
		if (shape.shape_id !== expanded.shape_id) return shape;
		replaced = true;
		return expanded;
	});
	return replaced ? next : [...next, expanded];
}

export function parseStopBoardShapeStreamEvent(
	line: string,
): StopBoardShapeStreamEvent | null {
	const trimmed = line.trim();
	if (!trimmed) return null;
	const parsed = JSON.parse(trimmed) as StopBoardShapeStreamEvent;
	if (
		parsed?.type === "refs" ||
		parsed?.type === "shape" ||
		parsed?.type === "done"
	) {
		return parsed;
	}
	return null;
}
