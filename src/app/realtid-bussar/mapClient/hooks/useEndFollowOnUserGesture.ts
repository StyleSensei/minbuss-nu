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
		const tiltListener = google.maps.event.addListener(
			map,
			"tilt_changed",
			endFollow,
		);
		const headingListener = google.maps.event.addListener(
			map,
			"heading_changed",
			endFollow,
		);
		const div = map.getDiv();
		const onWheel = () => endFollow();
		div.addEventListener("wheel", onWheel, { passive: true });

		return () => {
			google.maps.event.removeListener(dragListener);
			google.maps.event.removeListener(tiltListener);
			google.maps.event.removeListener(headingListener);
			div.removeEventListener("wheel", onWheel);
		};
	}, [mapReady, mapRef, setFollowBus]);
}
