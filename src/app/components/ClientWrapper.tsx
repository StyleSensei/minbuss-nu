"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

export const ClientWrapper = ({ children }: { children: React.ReactNode }) => {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const isMobile = useIsMobile();

	useEffect(() => {
		if (!ref.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					const [entry] = entries;
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{
				threshold: isMobile ? 0.15 : 0.7,
			},
		);

		observer.observe(ref.current);

		return () => observer.disconnect();
	}, [isMobile]);

	return (
		<div className={`client-wrapper ${isVisible ? "visible" : ""}`} ref={ref}>
			{children}
		</div>
	);
};
