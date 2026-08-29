"use client";

import { useVisualHeading } from "../hooks/useVisualHeading";

interface UserLocationMarkerProps {
	heading: number | null;
	visible: boolean;
	labelFontSize: number;
}

export function UserLocationMarker({
	heading,
	visible,
	labelFontSize,
}: UserLocationMarkerProps) {
	const visualHeading = useVisualHeading(heading);

	return (
		<>
			<div className="user-location-marker">
				{visualHeading != null && (
					<div
						className={`user-location__heading ${visible ? "--visible" : ""}`}
						style={{ transform: `rotate(${visualHeading}deg)` }}
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
