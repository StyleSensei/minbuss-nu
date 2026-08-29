"use client";

import { useEffect, useRef } from "react";

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
	const headingRef = useRef<HTMLDivElement>(null);

	// AdvancedMarker uppdaterar ibland inte inline-styles vid state-ändringar;
	// skriv transform direkt så kompassrotation syns utan ny GPS-position.
	useEffect(() => {
		if (!headingRef.current || heading == null) return;
		headingRef.current.style.transform = `rotate(${heading}deg)`;
	}, [heading]);

	return (
		<>
			<div className="user-location-marker">
				{heading != null && (
					<div
						ref={headingRef}
						className={`user-location__heading ${visible ? "--visible" : ""}`}
						style={{ transform: `rotate(${heading}deg)` }}
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
