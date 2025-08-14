"use client";
import { close, search } from "../../../public/icons";
import { Paths } from "../paths";
import { SearchBar } from "./SearchBar";
import { usePathname } from "next/navigation";

export const Header = () => {
	const pathName = usePathname();
	return (
		<header className="header__container">
			{pathName === `${Paths.Search}` && (
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
