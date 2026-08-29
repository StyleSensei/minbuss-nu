"use client";

import { useAnimatedHeading } from "../hooks/useAnimatedHeading";

interface UserLocationMarkerProps {
	heading: number | null;
	mapBearing: number;
	visible: boolean;
	labelFontSize: number;
}

export function UserLocationMarker({
	heading,
	mapBearing,
	visible,
	labelFontSize,
}: UserLocationMarkerProps) {
	const headingRef = useAnimatedHeading(heading, mapBearing);

	return (
		<>
			<div className="user-location-marker">
				{heading != null && (
					<div
						ref={headingRef}
						className={`user-location__heading ${visible ? "--visible" : ""}`}
					/>
				)}
				<div className={`user-location ${visible ? "--visible" : ""}`} />
			</div>
			<div className={`user-location__container ${visible ? "--visible" : ""}`}>
				<span
					className="user-location__text"
					style={{ fontSize: labelFontSize }}
				>
					Min position
				</span>
			</div>
		</>
	);
}
