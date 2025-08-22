import { useState, useEffect } from "react";

export const useIsMobile = () => {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const checkIfMobile = () => {
			const hasTouchScreen =
				("maxTouchPoints" in navigator && navigator.maxTouchPoints > 0) ||
				("msMaxTouchPoints" in navigator &&
					(navigator as Navigator & { msMaxTouchPoints: number })
						.msMaxTouchPoints > 0);

			const smallViewport = window.innerWidth <= 768;

			const mobileUA =
				/iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
					navigator.userAgent,
				);

			const hasDeviceEmulation =
				/Chrome/.test(navigator.userAgent) &&
				/Mobile/.test(navigator.userAgent);

			setIsMobile(
				smallViewport || mobileUA || hasTouchScreen || hasDeviceEmulation,
			);
		};

		checkIfMobile();
		window.addEventListener("resize", checkIfMobile);

		return () => window.removeEventListener("resize", checkIfMobile);
	}, []);

	return isMobile;
};
