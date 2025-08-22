"use client";

import { Paths } from "@/app/paths";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

export const MenuBarSelection = () => {
	const pathname = usePathname();

	const getClassNames = useCallback((pathname: string) => {
		switch (pathname) {
			case "/":
				return "home";
			case `${Paths.Search}`:
				return "map";
			case `${Paths.About}`:
				return "info";
			default:
				return "not-found";
		}
	}, []);

	return (
		<div className="menu-bar__outer-container">
			<div
				className={`menu-bar__inner-container ${getClassNames(pathname) || "not-found"}`}
			>
				<div className="menu-bar__selection"> </div>
			</div>
		</div>
	);
};
