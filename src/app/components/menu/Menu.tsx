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

export default function Menu() {
	const router = useRouter();
	const pathname = usePathname();

	enum HREF {
		home = "/",
		search = "/karta",
		info = "/info",
	}

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
						path={pathname === HREF.home ? houseDoorFill : houseDoor}
						fill="currentColor"
						pathname={pathname}
					/>
					<MenuItem
						title="Sök"
						href="/karta"
						iconSize={iconSize}
						className="link__map"
						path={pathname === HREF.search ? searchFill : search}
						fill="currentColor"
						pathname={pathname}
					/>
					<MenuItem
						title="Info"
						href="/info"
						iconSize={iconSize}
						className="link__info"
						path={pathname === HREF.info ? infoCircleFill : infoCircle}
						fill="currentColor"
						pathname={pathname}
					/>
				</div>
				<MenuBarSelection />
			</div>
		</nav>
	);
}
