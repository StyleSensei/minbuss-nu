import type { MapMouseEvent } from "@vis.gl/react-google-maps";

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

/** På mobil kan kartans click köas före markören. Ignorera klick som kommer från vårt hållplats-UI. */
export function isClickFromStopUi(e: MapMouseEvent): boolean {
	const raw = e.domEvent?.target;
	if (!raw || !(raw instanceof Element)) return false;
	return Boolean(
		raw.closest("[data-stop-marker]") ||
			raw.closest(".stop-marker-visibility-wrap"),
	);
}
