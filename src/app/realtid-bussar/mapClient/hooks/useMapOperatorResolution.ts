import { getOperatorMapView } from "@shared/config/gtfsOperators";
import { useCallback, useMemo } from "react";
import { searchPathForOperator } from "../../../paths";
import { isPointInBounds } from "../mapClientGeometry";
import type { OperatorsMeta } from "./useOperatorsMeta";

export function useMapOperatorResolution(
	operatorsMeta: OperatorsMeta | null,
	operatorSlugFromPath: string | null,
	operatorUrlParam: string,
) {
	const mapOperatorForView = useMemo(() => {
		const pathSlug = operatorSlugFromPath ?? "";
		const querySlug = operatorUrlParam.trim().toLowerCase();
		if (!operatorsMeta) {
			if (pathSlug) return pathSlug;
			if (querySlug) return querySlug;
			return "sl";
		}
		if (pathSlug && operatorsMeta.operators.includes(pathSlug)) {
			return pathSlug;
		}
		if (querySlug && operatorsMeta.operators.includes(querySlug)) {
			return querySlug;
		}
		return operatorsMeta.defaultOperator;
	}, [operatorsMeta, operatorUrlParam, operatorSlugFromPath]);

	const operatorMapView = useMemo(
		() => getOperatorMapView(mapOperatorForView),
		[mapOperatorForView],
	);

	const findOperatorForPosition = useCallback(
		(lat: number, lng: number): string | null => {
			const operators = operatorsMeta?.operators ?? [mapOperatorForView];
			const matchingOperators = operators.filter((op) => {
				const view = getOperatorMapView(op);
				return isPointInBounds(lat, lng, view.restriction);
			});
			if (matchingOperators.length === 0) {
				return null;
			}
			if (matchingOperators.length === 1) {
				return matchingOperators[0];
			}

			// Bounds can overlap between operators. Pick the region whose
			// default center is closest to the user position.
			let best = matchingOperators[0];
			let bestDistance = Number.POSITIVE_INFINITY;
			for (const op of matchingOperators) {
				const { defaultCenter } = getOperatorMapView(op);
				const dLat = defaultCenter.lat - lat;
				const dLng = defaultCenter.lng - lng;
				const distanceSq = dLat * dLat + dLng * dLng;
				if (distanceSq < bestDistance) {
					bestDistance = distanceSq;
					best = op;
				}
			}
			return best;
		},
		[operatorsMeta?.operators, mapOperatorForView],
	);

	const searchHrefWithLinje = useCallback(
		(linje: string) => {
			const p = new URLSearchParams();
			p.set("linje", linje);
			return `${searchPathForOperator(mapOperatorForView)}?${p.toString()}`;
		},
		[mapOperatorForView],
	);

	return {
		mapOperatorForView,
		operatorMapView,
		findOperatorForPosition,
		searchHrefWithLinje,
	};
}
