import { useCallback, useEffect, useRef, useState } from "react";

export const useOverflow = <T extends HTMLElement = HTMLDivElement>() => {
	const containerRef = useRef<T>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

	const checkOverflow = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		setIsOverflowing(container.scrollHeight > container.clientHeight);

		const isAtBottom =
			container.scrollHeight - container.scrollTop - container.clientHeight < 5;
		setIsScrolledToBottom(isAtBottom);
	}, []);

	useEffect(() => {
		checkOverflow();
		window.addEventListener("resize", checkOverflow);
		return () => window.removeEventListener("resize", checkOverflow);
	}, [checkOverflow]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		container.addEventListener("scroll", checkOverflow);
		return () => container.removeEventListener("scroll", checkOverflow);
	}, [checkOverflow]);

	return { containerRef, isOverflowing, isScrolledToBottom, checkOverflow };
};
