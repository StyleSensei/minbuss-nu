import type { IShapes } from "@shared/models/IShapes";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { useMemo, useRef } from "react";
import type { ShapeGroup } from "../mapClientGeometry";

type LineShapeInput =
	| { shape_id: string; points?: IShapes[]; route_short_name?: string }[]
	| undefined;

export function useRouteShapesForMap(
	filteredVehicleData: IVehiclePosition[],
	lineShapes: LineShapeInput,
) {
	const routeShapesCacheRef = useRef<Map<string, IShapes[]>>(new Map());

	const routeShapes = useMemo(() => {
		const byId = new Map<string, ShapeGroup>();

		for (const ls of lineShapes ?? []) {
			if (ls.points?.length) {
				byId.set(ls.shape_id, {
					shape_id: ls.shape_id,
					points: ls.points,
					route_short_name: ls.route_short_name,
				});
			}
		}

		for (const v of filteredVehicleData) {
			if (!v.shapePoints?.length) continue;
			const id = v.shapePoints[0].shape_id;
			const points = v.shapePoints;
			const cached = routeShapesCacheRef.current.get(id);
			const sameShape =
				cached &&
				cached.length === points.length &&
				cached[0].shape_pt_lat === points[0].shape_pt_lat &&
				cached[0].shape_pt_lon === points[0].shape_pt_lon &&
				cached[cached.length - 1].shape_pt_lat ===
					points[points.length - 1].shape_pt_lat &&
				cached[cached.length - 1].shape_pt_lon ===
					points[points.length - 1].shape_pt_lon;
			const toUse = sameShape ? cached : points;
			if (!sameShape) routeShapesCacheRef.current.set(id, points);
			byId.set(id, {
				shape_id: id,
				points: toUse,
				route_short_name: byId.get(id)?.route_short_name,
			});
		}

		return Array.from(byId.values());
	}, [filteredVehicleData, lineShapes]);

	const lineShapesForFit: ShapeGroup[] = useMemo(
		() => (lineShapes as ShapeGroup[] | undefined) ?? [],
		[lineShapes],
	);

	return { routeShapes, lineShapesForFit };
}
