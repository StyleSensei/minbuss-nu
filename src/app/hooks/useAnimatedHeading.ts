"use client";

import { useEffect, useRef } from "react";
import { headingSmoothingFactor, lerpHeading } from "../utilities/headingMath";

/** Tidskonstant för mjuk kompassrotation (~280 ms). */
const SMOOTHING_MS = 280;

/**
 * Animerar kompassriktning med requestAnimationFrame.
 * mapBearing subtraheras vid rendering så nålen håller geografisk riktning
 * när användaren roterar kartan.
 */
export function useAnimatedHeading(heading: number | null, mapBearing = 0) {
	const elementRef = useRef<HTMLDivElement>(null);
	const currentRef = useRef<number | null>(null);
	const targetRef = useRef<number | null>(null);
	const mapBearingRef = useRef(mapBearing);
	const rafRef = useRef<number | null>(null);
	const lastFrameRef = useRef<number | null>(null);

	targetRef.current = heading;
	mapBearingRef.current = mapBearing;

	useEffect(() => {
		if (heading == null) {
			currentRef.current = null;
			lastFrameRef.current = null;
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			return;
		}

		if (currentRef.current == null) {
			currentRef.current = heading;
			elementRef.current?.style.setProperty(
				"transform",
				`rotate(${heading - mapBearingRef.current}deg)`,
			);
		}

		const tick = (now: number) => {
			const t = targetRef.current;
			const c = currentRef.current;
			if (t == null || c == null) {
				rafRef.current = null;
				return;
			}

			const last = lastFrameRef.current ?? now;
			const dt = Math.min(now - last, 64);
			lastFrameRef.current = now;

			const factor = headingSmoothingFactor(dt, SMOOTHING_MS);
			const next = lerpHeading(c, t, factor);
			currentRef.current = next;

			elementRef.current?.style.setProperty(
				"transform",
				`rotate(${next - mapBearingRef.current}deg)`,
			);

			rafRef.current = requestAnimationFrame(tick);
		};

		if (rafRef.current == null) {
			lastFrameRef.current = null;
			rafRef.current = requestAnimationFrame(tick);
		}

		return () => {
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			lastFrameRef.current = null;
		};
	}, [heading != null]);

	// Kompensera direkt när kartan roteras (utan att vänta på kompass-lerp).
	useEffect(() => {
		const c = currentRef.current;
		if (c == null || !elementRef.current) return;
		elementRef.current.style.setProperty(
			"transform",
			`rotate(${c - mapBearing}deg)`,
		);
	}, [mapBearing]);

	return elementRef;
}
