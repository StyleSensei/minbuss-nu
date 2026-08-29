/** Smallest signed difference between two compass headings (degrees). */
export function shortestAngleDelta(from: number, to: number): number {
	return ((to - from + 540) % 360) - 180;
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
