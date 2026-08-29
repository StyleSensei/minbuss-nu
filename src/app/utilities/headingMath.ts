/** Smallest signed difference between two compass headings (degrees). */
export function shortestAngleDelta(from: number, to: number): number {
	return ((to - from + 540) % 360) - 180;
}

/** Exponential smoothing factor for a given frame delta and time constant. */
export function headingSmoothingFactor(
	deltaMs: number,
	timeConstantMs: number,
): number {
	if (timeConstantMs <= 0) return 1;
	return 1 - Math.exp(-deltaMs / timeConstantMs);
}

/** Interpolate heading along the shortest arc. */
export function lerpHeading(
	current: number,
	target: number,
	factor: number,
): number {
	const delta = shortestAngleDelta(current, target);
	if (Math.abs(delta) < 0.05) return target;
	return current + delta * factor;
}

/** Low-pass filter for compass headings to reduce GPS jitter. */
export function smoothHeading(
	prev: number | null,
	next: number,
	factor = 0.35,
	epsilon = 5,
): number {
	if (prev === null) return next;
	const delta = shortestAngleDelta(prev, next);
	if (Math.abs(delta) < epsilon) return prev;
	return (prev + delta * factor + 360) % 360;
}
