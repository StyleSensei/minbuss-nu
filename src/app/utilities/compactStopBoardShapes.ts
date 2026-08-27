import type { IShapes } from "@shared/models/IShapes";
import type { IStopBoardShape } from "@shared/models/IStopBoardShape";

export const MAX_STOP_BOARD_SHAPE_POINTS = 240;

type CompactPoint = [number, number];

export interface ICompactStopBoardShape {
	route_short_name: string;
	route_type: number | null;
	shape_id: string;
	points: CompactPoint[];
}

export function downsampleShapePoints<T>(points: T[], maxPoints: number): T[] {
	if (points.length <= maxPoints || maxPoints < 2) return points;
	const lastIndex = points.length - 1;
	const picked = new Set<number>([0, lastIndex]);
	for (let i = 1; i < maxPoints - 1; i++) {
		picked.add(Math.round((i * lastIndex) / (maxPoints - 1)));
	}
	return [...picked].sort((a, b) => a - b).map((index) => points[index]);
}

export function compactStopBoardShapes(
	shapes: IStopBoardShape[],
	maxPoints = MAX_STOP_BOARD_SHAPE_POINTS,
): ICompactStopBoardShape[] {
	return shapes.map((shape) => ({
		route_short_name: shape.route_short_name,
		route_type: shape.route_type,
		shape_id: shape.shape_id,
		points: downsampleShapePoints(shape.points, maxPoints).map((point) => [
			Number(point.shape_pt_lat.toFixed(5)),
			Number(point.shape_pt_lon.toFixed(5)),
		]),
	}));
}

export function expandStopBoardShapes(
	shapes: ICompactStopBoardShape[],
): IStopBoardShape[] {
	return shapes.map((shape) => ({
		route_short_name: shape.route_short_name,
		route_type: shape.route_type,
		shape_id: shape.shape_id,
		points: shape.points.map(
			([lat, lng], index): IShapes => ({
				shape_id: shape.shape_id,
				shape_pt_lat: lat,
				shape_pt_lon: lng,
				shape_pt_sequence: index,
			}),
		),
	}));
}

export interface ICompactLineShape {
	shape_id: string;
	points: CompactPoint[];
}

export function compactLineShapes(
	shapes: { shape_id: string; points: IShapes[] }[],
	maxPoints = MAX_STOP_BOARD_SHAPE_POINTS,
): ICompactLineShape[] {
	return shapes.map((shape) => ({
		shape_id: shape.shape_id,
		points: downsampleShapePoints(shape.points, maxPoints).map((point) => [
			Number(point.shape_pt_lat.toFixed(5)),
			Number(point.shape_pt_lon.toFixed(5)),
		]),
	}));
}

export function expandLineShapes(
	shapes: ICompactLineShape[],
): { shape_id: string; points: IShapes[] }[] {
	return shapes.map((shape) => ({
		shape_id: shape.shape_id,
		points: shape.points.map(
			([lat, lng], index): IShapes => ({
				shape_id: shape.shape_id,
				shape_pt_lat: lat,
				shape_pt_lon: lng,
				shape_pt_sequence: index,
			}),
		),
	}));
}
