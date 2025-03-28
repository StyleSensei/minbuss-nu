"use client";
import { MenuItem } from "./MenuItem";
import { houseDoorFill, info, search } from "../../../../public/icons";
import { MenuBarSelection } from "./MenuBarSelection";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Menu() {
	const router = useRouter();
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
						path={houseDoorFill}
						fill="currentColor"
					/>
					<MenuItem
						title="Sök"
						href="/karta"
						iconSize={iconSize}
						className="link__map"
						path={search}
						fill="currentColor"
					/>
					<MenuItem
						title="Info"
						href="/info"
						iconSize={iconSize}
						className="link__info"
						path={info}
						fill="currentColor"
					/>
				</div>
				<MenuBarSelection />
			</div>
		</nav>
	);
}
