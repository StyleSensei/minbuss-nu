import { useRouter } from "next/navigation";
import { type MutableRefObject, useEffect, useRef } from "react";
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
	mapRef: MutableRefObject<google.maps.Map | null>,
	linjeParam: string,
	lineShapesForFit: ShapeGroup[],
	routeShapes: ShapeGroup[],
	mapFitParam: boolean,
	mapOperatorForView: string,
	initialLinjeFromDocumentRef: MutableRefObject<string | null>,
	lastLineShapeFitKeyRef: MutableRefObject<string>,
	setFollowBus: (v: boolean) => void,
) {
	const router = useRouter();
	const hasDoneInitialDocumentLinjeFitRef = useRef(false);

	useEffect(() => {
		if (!mapReady || !mapRef.current || !linjeParam) return;

		const bounds = boundsFromLineOrRouteShapes(lineShapesForFit, routeShapes);
		const initialLinje = initialLinjeFromDocumentRef.current ?? "";
		const allowInitialDocumentFit =
			!hasDoneInitialDocumentLinjeFitRef.current &&
			Boolean(initialLinje) &&
			linjeParam === initialLinje;

		const shouldFit = mapFitParam || allowInitialDocumentFit;

		if (!bounds) {
			return;
		}

		if (!shouldFit) {
			lastLineShapeFitKeyRef.current = linjeParam;
			return;
		}

		hasDoneInitialDocumentLinjeFitRef.current = true;
		lastLineShapeFitKeyRef.current = linjeParam;

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
		linjeParam,
		lineShapesForFit,
		routeShapes,
		mapFitParam,
		router,
		mapOperatorForView,
		mapRef,
		initialLinjeFromDocumentRef,
		lastLineShapeFitKeyRef,
		setFollowBus,
	]);
}
