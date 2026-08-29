"use client";

import { useEffect, useRef } from "react";
import {
	headingSmoothingFactor,
	lerpHeading,
} from "../utilities/headingMath";

/** Tidskonstant för mjuk kompassrotation (~280 ms). */
const SMOOTHING_MS = 280;

/**
 * Animerar kompassriktning med requestAnimationFrame i stället för CSS-transition,
 * så nya målvärden inte avbryter pågående animationer.
 */
export function useAnimatedHeading(target: number | null) {
	const elementRef = useRef<HTMLDivElement>(null);
	const currentRef = useRef<number | null>(null);
	const targetRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameRef = useRef<number | null>(null);

	targetRef.current = target;

	useEffect(() => {
		if (target == null) {
			currentRef.current = null;
			lastFrameRef.current = null;
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			return;
		}

		if (currentRef.current == null) {
			currentRef.current = target;
			elementRef.current?.style.setProperty(
				"transform",
				`rotate(${target}deg)`,
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
				`rotate(${next}deg)`,
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
	}, [target != null]);

	return elementRef;
}
