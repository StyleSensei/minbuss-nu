"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { getFilteredVehiclePositions } from "../actions/filterVehicles";
import { useFilterContext } from "../context/FilterContext";

function debounce(cb: (query: string) => void, delay = 250) {
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
	const { setFilteredVehicles, filteredVehicles } = useFilterContext();
	const intervalRef = useRef<NodeJS.Timeout>();

	const handleOnChange = useCallback(
		debounce(async (query: string) => {
			setFilteredVehicles(await getFilteredVehiclePositions(query));
		}, 250),
		[],
	);

	const pollBusPositionsEveryTwoSeconds = useCallback(
		(query: string) => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			intervalRef.current = setInterval(async () => {
				setFilteredVehicles(await getFilteredVehiclePositions(query));
			}, 2000);
		},
		[setFilteredVehicles],
	);

	useEffect(() => {
		if (userInput) {
			handleOnChange(userInput);
		}
		if (!userInput) {
			setFilteredVehicles([]);
		}
		if (userInput && filteredVehicles.length)
			pollBusPositionsEveryTwoSeconds(userInput);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [
		userInput,
		handleOnChange,
		filteredVehicles.length,
		pollBusPositionsEveryTwoSeconds,
		setFilteredVehicles,
	]);
	// console.log("filteredVehicles:", filteredVehicles);
	// console.log("intervalRef.current:", intervalRef.current);

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
