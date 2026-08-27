import type { MapMouseEvent } from "@vis.gl/react-google-maps";
import {
	belongsToFocusedStation,
	type IStopPositionJson,
} from "../stopPositionsTypes";

/** Gul kartmarkör: klickad child/grupp går före lägesfilter och parent-id. */
export function resolveActiveStopMarkerId(
	clickedStopId: string | null,
	platformFilterId: string | null | undefined,
	scheduleStopId: string | null | undefined,
	boardOpen: boolean,
): string | undefined {
	if (clickedStopId) return clickedStopId;
	if (!boardOpen) return undefined;
	return platformFilterId ?? scheduleStopId ?? undefined;
}

/** Parent och barn i samma stationsgrupp markeras tillsammans, oavsett vilken som klickades. */
export function isStopMarkerActive(
	stop: Pick<IStopPositionJson, "id" | "parent" | "isParent" | "presentation">,
	activeStopId: string | null | undefined,
	focusedParentIds: ReadonlySet<string>,
	detailMode: boolean,
): boolean {
	if (stop.presentation === "platform-label") return false;
	const isGroupStop = stop.presentation === "group-stop";
	if (!detailMode && !isGroupStop) return false;
	if (
		activeStopId &&
		(stop.id === activeStopId || stop.parent === activeStopId)
	) {
		return true;
	}
	return belongsToFocusedStation(stop, focusedParentIds);
}

/** På mobil kan kartans click köas före markören. Ignorera klick som kommer från vårt hållplats-UI. */
export function isClickFromStopUi(e: MapMouseEvent): boolean {
	const raw = e.domEvent?.target;
	if (!raw || !(raw instanceof Element)) return false;
	return Boolean(
		raw.closest("[data-stop-marker]") ||
			raw.closest(".stop-marker-visibility-wrap"),
	);
}
