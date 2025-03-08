import { useCallback } from "react";

export const useSetZoom = () => {
	const setZoom = useCallback((GoogleMap: google.maps.Map) => {
		GoogleMap.setZoom(17);
	}, []);
	return setZoom;
};
