"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import {
	AdvancedMarker,
	AdvancedMarkerAnchorPoint,
	useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";

interface ICustomMarkerProps {
	position: { lat: number; lng: number };
}

export default function CustomMarker({ position }: ICustomMarkerProps) {
	const [markerRef, marker] = useAdvancedMarkerRef();

	useGSAP(() => {
		if (marker) {
			const currentPosition = marker.position
				? { lat: marker.position.lat, lng: marker.position.lng }
				: position;
			gsap.to(currentPosition, {
				duration: 4,
				ease: "sine",
				lat: position.lat,
				lng: position.lng,
				onUpdate: () => {
					if (marker) {
						marker.position = new google.maps.LatLng(
							+currentPosition.lat,
							+currentPosition.lng,
						);
					}
				},
			});
		}
	}, [position, marker]);

	return (
		<AdvancedMarker
			ref={markerRef}
			position={position}
			anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
			className="custom-marker"
		>
			<div> </div>
		</AdvancedMarker>
	);
}
