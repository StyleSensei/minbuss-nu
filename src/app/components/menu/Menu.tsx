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
		about = "/om",
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
					/>
					<MenuItem
						title="Sök"
						href="/karta"
						iconSize={iconSize}
						className="link__map"
						path={pathname === HREF.search ? searchFill : search}
						fill="currentColor"
					/>
					<MenuItem
						title="Om"
						href="/om"
						iconSize={iconSize}
						className="link__info"
						path={pathname === HREF.about ? infoCircleFill : infoCircle}
						fill="currentColor"
					/>
				</div>
				<MenuBarSelection />
			</div>
		</nav>
	);
}
