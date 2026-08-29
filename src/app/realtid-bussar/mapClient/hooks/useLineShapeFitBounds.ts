import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef } from "react";
import { searchPathForOperator } from "../../../paths";
import {
	LINE_SHAPE_FIT_MAX_ZOOM,
	LINE_SHAPE_FIT_PADDING,
} from "../mapClientConstants";
import {
	boundsFromLineOrRouteShapes,
	type ShapeGroup,
} from "../mapClientGeometry";

export function useLineShapeFitBounds(
	mapReady: boolean,
	mapRef: RefObject<google.maps.Map | null>,
	shapeScopeKey: string,
	lineShapesForFit: ShapeGroup[],
	routeShapes: ShapeGroup[],
	mapFitParam: boolean,
	fitOnShapeScopeChange: boolean,
	mapOperatorForView: string,
	initialLinjeFromDocumentRef: RefObject<string | null>,
	lastLineShapeFitKeyRef: RefObject<string>,
	setFollowBus: (v: boolean) => void,
) {
	const router = useRouter();
	const hasDoneInitialDocumentLinjeFitRef = useRef(false);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !shapeScopeKey) return;

		const bounds = boundsFromLineOrRouteShapes(lineShapesForFit, routeShapes);
		const initialLinje = initialLinjeFromDocumentRef.current ?? "";
		const allowInitialDocumentFit =
			!fitOnShapeScopeChange &&
			!hasDoneInitialDocumentLinjeFitRef.current &&
			Boolean(initialLinje) &&
			shapeScopeKey === initialLinje;
		const shapeScopeChanged = lastLineShapeFitKeyRef.current !== shapeScopeKey;

		const shouldFit =
			mapFitParam ||
			allowInitialDocumentFit ||
			(fitOnShapeScopeChange && shapeScopeChanged);

		if (!bounds) {
			return;
		}

		if (!shouldFit) {
			lastLineShapeFitKeyRef.current = shapeScopeKey;
			return;
		}

		hasDoneInitialDocumentLinjeFitRef.current = true;
		lastLineShapeFitKeyRef.current = shapeScopeKey;

		const map = mapRef.current;
		setFollowBus(false);

		map.fitBounds(bounds, {
			top: LINE_SHAPE_FIT_PADDING,
			right: LINE_SHAPE_FIT_PADDING,
			bottom: LINE_SHAPE_FIT_PADDING,
			left: LINE_SHAPE_FIT_PADDING,
		});
		const capListener = google.maps.event.addListenerOnce(map, "idle", () => {
			const zz = map.getZoom();
			if (zz != null && zz > LINE_SHAPE_FIT_MAX_ZOOM) {
				map.setZoom(LINE_SHAPE_FIT_MAX_ZOOM);
			}
			if (mapFitParam && typeof window !== "undefined") {
				const params = new URLSearchParams(window.location.search);
				if (params.has("mapfit")) {
					params.delete("mapfit");
					const qs = params.toString();
					const base = searchPathForOperator(mapOperatorForView);
					router.replace(qs ? `${base}?${qs}` : base);
				}
			}
		});
		return () => {
			google.maps.event.removeListener(capListener);
		};
	}, [
		mapReady,
		shapeScopeKey,
		lineShapesForFit,
		routeShapes,
		mapFitParam,
		fitOnShapeScopeChange,
		router,
		mapOperatorForView,
		mapRef,
		initialLinjeFromDocumentRef,
		lastLineShapeFitKeyRef,
		setFollowBus,
	]);
}
