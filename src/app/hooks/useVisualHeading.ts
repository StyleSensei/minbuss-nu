import { useEffect, useRef, useState } from "react";
import { shortestAngleDelta } from "../utilities/headingMath";

/**
 * Gör att CSS transition roterar längs kortaste vägen (359° → 1° blir +2°, inte −358°).
 * Håller en ackumulerad vinkel så transform-animationer inte rycker vid 0/360.
 */
export function useVisualHeading(target: number | null): number | null {
	const trackRef = useRef<number | null>(null);
	const [visual, setVisual] = useState<number | null>(null);

	useEffect(() => {
		if (target == null) {
			trackRef.current = null;
			setVisual(null);
			return;
		}

		setVisual((prev) => {
			if (prev == null || trackRef.current == null) {
				trackRef.current = target;
				return target;
			}

			const delta = shortestAngleDelta(trackRef.current % 360, target);
			const next = trackRef.current + delta;
			trackRef.current = next;
			return next;
		});
	}, [target]);

	return visual;
}
