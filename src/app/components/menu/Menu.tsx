"use client";
import { MenuItem } from "./MenuItem";
import {
	houseDoor,
	houseDoorFill,
	infoCircle,
	infoCircleFill,
	search,
	searchFill,
} from "../../../../public/icons";
import { MenuBarSelection } from "./MenuBarSelection";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Paths } from "@/app/paths";

export default function Menu() {
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				router.refresh();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [router]);

	const iconSize = "18";

	return (
		<nav className="wrapper" aria-label="Main navigation">
			<div className="outer-container">
				<div className="inner-container">
					<MenuItem
						title="Hem"
						href="/"
						iconSize={iconSize}
						className="link__home"
						path={pathname === Paths.Home ? houseDoorFill : houseDoor}
						fill="currentColor"
					/>
					<MenuItem
						title="Sök"
						href={`${Paths.Search}`}
						iconSize={iconSize}
						className="link__map"
						path={pathname === Paths.Search ? searchFill : search}
						fill="currentColor"
					/>
					<MenuItem
						title="Om"
						href={`${Paths.About}`}
						iconSize={iconSize}
						className="link__info"
						path={pathname === Paths.About ? infoCircleFill : infoCircle}
						fill="currentColor"
					/>
				</div>
				<MenuBarSelection />
			</div>
		</nav>
	);
}
