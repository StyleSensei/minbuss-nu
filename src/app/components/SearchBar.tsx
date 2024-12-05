"use client";
import { use, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { getFilteredVehiclePositions } from "../actions/filterVehicles";
import { useFilterContext } from "../context/FilterContext";

function debounce(cb: (query: string) => void, delay = 500) {
	let timeout: NodeJS.Timeout;

	return (...args: [string]) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			cb(...args);
		}, delay);
	};
}

interface SearchBarProps {
	iconSize: string;
	fill?: string;
	title: string;
	path: string;
	title2?: string;
	path2?: string;
}
export const SearchBar = ({
	iconSize,
	fill = "whitesmoke",
	title,
	path,
	title2,
	path2,
}: SearchBarProps) => {
	const [userInput, setUserInput] = useState<string>("");
	const { setFilteredVehicles } = useFilterContext();

	useEffect(() => {
		if (userInput) handleOnChange(userInput);
	}, [userInput]);

	const handleOnChange = debounce(async (query: string) => {
		setFilteredVehicles(await getFilteredVehiclePositions(query));
	}, 500);

	return (
		<>
			<div className="search-bar__container">
				<Icon path={path} fill={fill} iconSize={iconSize} title={title} />
				<input
					type="text"
					placeholder="Sök busslinje..."
					className="search-bar__input"
					onChange={(e) => setUserInput(e.target.value)}
					value={userInput}
				/>
				{userInput && title2 && path2 && (
					<button
						className="reset-button"
						type="reset"
						onClick={() => setUserInput("")}
					>
						<Icon path={path2} fill={fill} iconSize={iconSize} title={title2} />
					</button>
				)}
			</div>
		</>
	);
};
