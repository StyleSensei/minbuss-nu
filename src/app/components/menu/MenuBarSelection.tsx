"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";

export const MenuBarSelection = () => {
	const pathname = usePathname();

	const getClassNames = useCallback((pathname: string) => {
		switch (pathname) {
			case "/":
				return "home";
			case "/karta":
				return "map";
			case "/om":
				return "info";
			default:
				return "home";
		}
	}, []);

	return (
		<div className="menu-bar__outer-container">
			<div className={`menu-bar__inner-container ${getClassNames(pathname)}`}>
				<div className="menu-bar__selection"> </div>
			</div>
		</div>
	);
};
