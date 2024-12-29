import { useCallback, useEffect, useRef, useState } from "react";

export const useOverflow = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);

	const checkOverflow = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		setIsOverflowing(container.scrollHeight > container.clientHeight);
	}, []);

	useEffect(() => {
		checkOverflow();
		window.addEventListener("resize", checkOverflow);
		return () => window.removeEventListener("resize", checkOverflow);
	}, [checkOverflow]);

	return { containerRef, isOverflowing };
};
