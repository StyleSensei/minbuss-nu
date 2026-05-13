import type { MapMouseEvent } from "@vis.gl/react-google-maps";

/** På mobil kan kartans click köas före markör/knapp — då rensas preview innan linjeval. Ignorera klick som kommer från vårt hållplats-UI. */
export function isClickFromStopUi(e: MapMouseEvent): boolean {
	const raw = e.domEvent?.target;
	if (!raw || !(raw instanceof Element)) return false;
	return Boolean(
		raw.closest(".map-stop-preview") ||
			raw.closest("[data-stop-marker]") ||
			raw.closest(".stop-marker-visibility-wrap"),
	);
}
