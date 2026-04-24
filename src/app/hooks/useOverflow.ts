import { useCallback, useEffect, useRef, useState } from "react";

type UseOverflowOptions = {
	bottomThreshold?: number;
};

export const useOverflow = <T extends HTMLElement = HTMLDivElement>(
	options?: UseOverflowOptions,
) => {
	const bottomThreshold = options?.bottomThreshold ?? 20;
	const containerRef = useRef<T>(null);
	const activeScrollElementRef = useRef<T | null>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

	const checkOverflow = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		const sh = container.scrollHeight;
		const ch = container.clientHeight;
		const st = container.scrollTop;
		const overflowing = sh > ch;
		const distanceFromBottom = sh - st - ch;
		// Slack for subpixel layout and rubber-band scrolling near the bottom
		const isAtBottom = !overflowing || distanceFromBottom < bottomThreshold;

		setIsOverflowing(overflowing);
		setIsScrolledToBottom(isAtBottom);
	}, [bottomThreshold]);

	useEffect(() => {
		checkOverflow();
		window.addEventListener("resize", checkOverflow);
		return () => window.removeEventListener("resize", checkOverflow);
	}, [checkOverflow]);

	useEffect(() => {
		const nextElement = containerRef.current;
		const prevElement = activeScrollElementRef.current;

		if (prevElement === nextElement) return;

		if (prevElement) {
			prevElement.removeEventListener("scroll", checkOverflow);
		}
		if (nextElement) {
			nextElement.addEventListener("scroll", checkOverflow);
		}
		activeScrollElementRef.current = nextElement;
	});

	useEffect(() => {
		return () => {
			const current = activeScrollElementRef.current;
			if (current) {
				current.removeEventListener("scroll", checkOverflow);
			}
		};
	}, [checkOverflow]);

	return { containerRef, isOverflowing, isScrolledToBottom, checkOverflow };
};
