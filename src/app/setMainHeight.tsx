"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function SetMainHeight() {
	const pathname = usePathname();

	useEffect(() => {
		const main = document.getElementById("main");
		if (!main) return;
		if (pathname === "/") {
			main.style.height = "100dvh";
		} else {
			main.style.height = "";
		}
	}, [pathname]);

	return null;
}
