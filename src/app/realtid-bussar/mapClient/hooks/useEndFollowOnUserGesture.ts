import { type MutableRefObject, useEffect } from "react";

export function useEndFollowOnUserGesture(
	mapReady: boolean,
	mapRef: MutableRefObject<google.maps.Map | null>,
	setFollowBus: (v: boolean) => void,
) {
	useEffect(() => {
		if (!mapReady) return;
		const map = mapRef.current;
		if (!map) return;

		const endFollow = () => setFollowBus(false);

		const dragListener = google.maps.event.addListener(
			map,
			"dragstart",
			endFollow,
		);
		const div = map.getDiv();
		const onWheel = () => endFollow();
		div.addEventListener("wheel", onWheel, { passive: true });

		return () => {
			google.maps.event.removeListener(dragListener);
			div.removeEventListener("wheel", onWheel);
		};
	}, [mapReady, mapRef, setFollowBus]);
}
