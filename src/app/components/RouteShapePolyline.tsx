"use client";

import { memo, useEffect, useMemo, useRef } from "react";
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
	onClick?: () => void;
}

function toLatLngs(shapePoints: IShapes[]) {
	return shapePoints.map((pt) => ({
		lat: pt.shape_pt_lat,
		lng: pt.shape_pt_lon,
	}));
}

function bindPolylineClick(
	polyline: google.maps.Polyline,
	onClickRef: MutableRefObject<(() => void) | undefined>,
) {
	const listener = polyline.addListener(
		"click",
		(event: google.maps.PolyMouseEvent) => {
			event.stop?.();
			onClickRef.current?.();
		},
	);
	return () => google.maps.event.removeListener(listener);
}

function createRoutePolylines(
	map: google.maps.Map,
	path: google.maps.LatLngLiteral[],
	options: {
		strokeColor: string;
		strokeOpacity: number;
		strokeWeight: number;
		clickable: boolean;
	},
) {
	const visual = new google.maps.Polyline({
		path,
		geodesic: true,
		strokeColor: options.strokeColor,
		strokeOpacity: options.strokeOpacity,
		strokeWeight: options.strokeWeight,
		clickable: false,
		zIndex: 2,
	});
	visual.setMap(map);

	let hit: google.maps.Polyline | null = null;
	if (options.clickable) {
		hit = new google.maps.Polyline({
			path,
			geodesic: true,
			strokeColor: options.strokeColor,
			strokeOpacity: 0.01,
			strokeWeight: Math.max(options.strokeWeight * 4, 12),
			clickable: true,
			zIndex: 3,
		});
		hit.setMap(map);
	}

	return { visual, hit };
}

function RouteShapePolyline({
	googleMapRef,
	hasActiveVehicle,
	shapePoints,
	mapReady = false,
	strokeColor = hasActiveVehicle ? colors.accentColor : colors.notValid,
	strokeWeight = 3,
	strokeOpacity = 0.7,
	animateReveal = false,
	animationDuration = 1.8,
	onClick,
}: RouteShapePolylineProps) {
	const polylineRef = useRef<google.maps.Polyline | null>(null);
	const hitPolylineRef = useRef<google.maps.Polyline | null>(null);
	const onClickRef = useRef(onClick);
	onClickRef.current = onClick;
	const shapeKey = useMemo(() => getShapeKey(shapePoints), [shapePoints]);
	const clickable = Boolean(onClick);

	useEffect(() => {
		if (animateReveal) return;

		const map = googleMapRef.current;
		if (!mapReady || !map || !shapePoints || shapePoints.length < 2) {
			return;
		}

		const { visual, hit } = createRoutePolylines(map, toLatLngs(shapePoints), {
			strokeColor,
			strokeOpacity,
			strokeWeight,
			clickable,
		});
		polylineRef.current = visual;
		hitPolylineRef.current = hit;
		const unbindClick = hit ? bindPolylineClick(hit, onClickRef) : undefined;

		return () => {
			unbindClick?.();
			visual.setMap(null);
			hit?.setMap(null);
			polylineRef.current = null;
			hitPolylineRef.current = null;
		};
	}, [
		animateReveal,
		clickable,
		googleMapRef,
		mapReady,
		shapeKey,
		strokeColor,
		strokeOpacity,
		strokeWeight,
	]);

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
			const fullPath = toLatLngs(shapePoints);
			const { visual, hit } = createRoutePolylines(map, fullPath.slice(0, 2), {
				strokeColor,
				strokeOpacity,
				strokeWeight,
				clickable,
			});
			hit?.setPath(fullPath);
			polylineRef.current = visual;
			hitPolylineRef.current = hit;
			const unbindClick = hit ? bindPolylineClick(hit, onClickRef) : undefined;

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
					visual.setPath(fullPath.slice(0, pointCount));
				},
			});

			return () => {
				unbindClick?.();
				visual.setMap(null);
				hit?.setMap(null);
				polylineRef.current = null;
				hitPolylineRef.current = null;
			};
		},
		{
			dependencies: [
				animateReveal,
				clickable,
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

export default memo(RouteShapePolyline);
