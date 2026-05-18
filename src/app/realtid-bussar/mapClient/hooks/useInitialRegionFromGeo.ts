import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { IUser } from "../../../hooks/useUserPosition";
import { hrefForOperatorAtUserPosition } from "../mapClientRegionNavigation";
import type { OperatorsMeta } from "./useOperatorsMeta";

const GEO_WAIT_MS = 4000;

/**
 * Vid första GPS-fix: byt region-URL till den operatör som omfattar positionen
 * (samma logik som "Min position"), innan kartan monteras på fel region.
 */
export function useInitialRegionFromGeo(
	effectivePosition: IUser | null,
	operatorsMeta: OperatorsMeta | null,
	mapOperatorForView: string,
	findOperatorForPosition: (lat: number, lng: number) => string | null,
	focusUserParam: boolean,
) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const decisionDoneRef = useRef(false);
	const geoWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [regionResolved, setRegionResolved] = useState(focusUserParam);

	useEffect(() => {
		if (focusUserParam) {
			setRegionResolved(true);
			return;
		}
		if (decisionDoneRef.current) return;
		if (!operatorsMeta) return;

		const finishWithoutRedirect = () => {
			decisionDoneRef.current = true;
			if (geoWaitTimerRef.current) {
				clearTimeout(geoWaitTimerRef.current);
				geoWaitTimerRef.current = null;
			}
			setRegionResolved(true);
		};

		if (!effectivePosition) {
			if (geoWaitTimerRef.current) return;
			geoWaitTimerRef.current = setTimeout(finishWithoutRedirect, GEO_WAIT_MS);
			return;
		}

		if (geoWaitTimerRef.current) {
			clearTimeout(geoWaitTimerRef.current);
			geoWaitTimerRef.current = null;
		}

		decisionDoneRef.current = true;
		const { lat, lng } = effectivePosition;
		const matchedOperator = findOperatorForPosition(lat, lng);

		if (!matchedOperator || matchedOperator === mapOperatorForView) {
			setRegionResolved(true);
			return;
		}

		router.replace(
			hrefForOperatorAtUserPosition(matchedOperator, searchParams),
		);
	}, [
		effectivePosition,
		operatorsMeta,
		mapOperatorForView,
		findOperatorForPosition,
		focusUserParam,
		searchParams,
		router,
	]);

	useEffect(() => {
		return () => {
			if (geoWaitTimerRef.current) {
				clearTimeout(geoWaitTimerRef.current);
			}
		};
	}, []);

	return regionResolved;
}
