"use client";
import { close, search } from "../../../public/icons";
import { SearchBar } from "./SearchBar";
import { usePathname } from "next/navigation";

export const Header = () => {
	const pathName = usePathname();
	return (
		<header className="header__container">
			{pathName === "/karta" && (
				<SearchBar
					title="search-bus"
					iconSize="24"
					path={search}
					title2="close"
					path2={close}
				/>
			)}
		</header>
	);
};
