"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { IShapes } from "@shared/models/IShapes";
import colors from "../colors";

/** Stabil nyckel så att effekten inte kör om bara för att shapePoints fick ny referens (samma rutt). */
function getShapeKey(points: IShapes[] | undefined): string {
	if (!points?.length) return "";
	const first = points[0];
	const last = points[points.length - 1];
	return `${first.shape_id}-${points.length}-${first.shape_pt_lat}-${first.shape_pt_lon}-${last?.shape_pt_lat}-${last?.shape_pt_lon}`;
}

interface RouteShapePolylineProps {
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	hasActiveVehicle: boolean;
	shapePoints: IShapes[];
	mapReady?: boolean;
	strokeColor?: string;
	strokeWeight?: number;
	strokeOpacity?: number;
	/** Animate route from start to end with GSAP to(). */
	animateReveal?: boolean;
	/** Duration of reveal animation in seconds (GSAP duration). */
	animationDuration?: number;

}

export default function RouteShapePolyline({
	googleMapRef,
	hasActiveVehicle,
	shapePoints,
	mapReady = false,
	strokeColor = hasActiveVehicle ? colors.accentColor : colors.notValid,
	strokeWeight = 3,
	strokeOpacity = 0.7,
	animateReveal = false,
	animationDuration = 1.8,
}: RouteShapePolylineProps) {
	const polylineRef = useRef<google.maps.Polyline | null>(null);
	const shapeKey = useMemo(() => getShapeKey(shapePoints), [shapePoints]);

	// Statisk rita (ingen animation) – beroende på shapeKey, inte shapePoints-referens
	useEffect(() => {
		if (animateReveal) return;

		const map = googleMapRef.current;
		if (!mapReady || !map || !shapePoints || shapePoints.length < 2) {
			return;
		}

		const path = shapePoints.map((pt) => ({
			lat: pt.shape_pt_lat,
			lng: pt.shape_pt_lon,
		}));

		const polyline = new google.maps.Polyline({
			path,
			geodesic: true,
			strokeColor,
			strokeOpacity,
			strokeWeight,
		});

		polyline.setMap(map);
		polylineRef.current = polyline;

		return () => {
			polyline.setMap(null);
			polylineRef.current = null;
		};
	}, [
		animateReveal,
		googleMapRef,
		mapReady,
		shapeKey,
		strokeColor,
		strokeOpacity,
		strokeWeight,
	]);

	// Animerad reveal med GSAP to() – shapeKey så att vi inte ritar om vid nya positioner
	useGSAP(
		() => {
			if (
				!animateReveal ||
				!mapReady ||
				!googleMapRef.current ||
				!shapePoints ||
				shapePoints.length < 2
			) {
				return;
			}

			const map = googleMapRef.current;
			const fullPath = shapePoints.map((pt) => ({
				lat: pt.shape_pt_lat,
				lng: pt.shape_pt_lon,
			}));

			const polyline = new google.maps.Polyline({
				path: fullPath.slice(0, 2),
				geodesic: true,
				strokeColor,
				strokeOpacity,
				strokeWeight,
			});

			polyline.setMap(map);
			polylineRef.current = polyline;

			const progress = { value: 0 };

			gsap.to(progress, {
				value: 1,
				duration: animationDuration,
				ease: "power2.out",
				onUpdate: () => {
					const pointCount = Math.max(
						2,
						Math.round(progress.value * fullPath.length),
					);
					polyline.setPath(fullPath.slice(0, pointCount));
				},
			});

			return () => {
				polyline.setMap(null);
				polylineRef.current = null;
			};
		},
		{
			dependencies: [
				animateReveal,
				mapReady,
				shapeKey,
				strokeColor,
				strokeOpacity,
				strokeWeight,
				animationDuration,
			],
			revertOnUpdate: true,
		},
	);

	return null;
}
