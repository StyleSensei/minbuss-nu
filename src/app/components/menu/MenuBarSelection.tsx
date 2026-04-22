"use client";

import { isRealtimeMapPath, Paths } from "@/app/paths";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

export const MenuBarSelection = () => {
	const pathname = usePathname();

	const getClassNames = useCallback((path: string) => {
		if (path === "/") return "home";
		if (isRealtimeMapPath(path)) return "map";
		if (path === Paths.About) return "info";
		return "not-found";
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
