import { useCallback } from "react";

export const useSetZoom = () => {
	const setZoom = useCallback((GoogleMap: google.maps.Map) => {
		if (GoogleMap.getZoom()! < 17) {
			GoogleMap.setZoom(17);
		}
	}, []);
	return setZoom;
};
