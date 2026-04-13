"use client";

import type { IDbData } from "@shared/models/IDbData";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { useCallback, useRef } from "react";
import type { IMapStopPreview } from "../context/DataContext";

export interface MapStopPreviewProps {
	preview: IMapStopPreview;
	onRouteSelect: (routeShortName: string, stop: IDbData) => void;
}

export function MapStopPreview({
	preview,
	onRouteSelect,
}: MapStopPreviewProps) {
	const lastRoutePickAtRef = useRef(0);

	const pickRoute = useCallback(
		(
			name: string,
			stop: IDbData,
			_source: "click" | "pointerup" | "touchend",
		) => {
			const now = Date.now();
			if (now - lastRoutePickAtRef.current < 350) {
				return;
			}
			lastRoutePickAtRef.current = now;
			onRouteSelect(name, stop);
		},
		[onRouteSelect],
	);

	return (
		<AdvancedMarker
			className="map-stop-preview-marker"
			zIndex={20}
			title={preview.stop.stop_name}
			position={
				new google.maps.LatLng({
					lat: preview.stop.stop_lat,
					lng: preview.stop.stop_lon,
				})
			}
		>
			<div
				className="map-stop-preview"
				onPointerDown={(e) => e.stopPropagation()}
				aria-busy={preview.routesLoading === true}
			>
				{preview.routesLoading ? (
					<>
						<div className="map-stop-preview__title-skeleton" aria-hidden />
						<div
							className="map-stop-preview__routes map-stop-preview__routes--loading"
							aria-hidden
						>
							<span className="map-stop-preview__route-chip-skeleton" />
							<span className="map-stop-preview__route-chip-skeleton" />
							<span className="map-stop-preview__route-chip-skeleton" />
						</div>
					</>
				) : (
					<>
						<p className="map-stop-preview__title">{preview.stop.stop_name}</p>
						<div className="map-stop-preview__routes">
							{[...preview.routeShortNames]
								.sort((a, b) => a.localeCompare(b, "sv"))
								.map((name) => (
									<button
										key={name}
										type="button"
										className="map-stop-preview__route-btn"
										onPointerUp={(e) => {
											e.stopPropagation();
											pickRoute(name, preview.stop, "pointerup");
										}}
										onTouchEnd={(e) => {
											e.stopPropagation();
											pickRoute(name, preview.stop, "touchend");
										}}
										onClick={(e) => {
											e.stopPropagation();
											pickRoute(name, preview.stop, "click");
										}}
									>
										{name}
									</button>
								))}
						</div>
					</>
				)}
			</div>
		</AdvancedMarker>
	);
}
