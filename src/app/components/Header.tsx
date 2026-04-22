"use client";
import { close, search } from "../../../public/icons";
import { isRealtimeMapPath } from "../paths";
import { SearchBar } from "./SearchBar";
import { usePathname } from "next/navigation";

export const Header = () => {
	const pathName = usePathname();
	return (
		<header className="header__container">
			{isRealtimeMapPath(pathName) && (
				<SearchBar
					title="sök"
					iconSize="24"
					path={search}
					title2="rensa"
					path2={close}
				/>
			)}
		</header>
	);
};
