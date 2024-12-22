"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { getFilteredVehiclePositions } from "../actions/filterVehicles";
import { useDataContext } from "../context/DataContext";
import { getCachedDbData } from "../services/cacheHelper";
import { getAllRoutes } from "../actions/getAllRoutes";
import { debounce } from "../utilities/debounce";
import colors from "../colors.module.scss";

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
	const [allRoutes, setAllRoutes] = useState<string[]>([]);
	const [routeExists, setRouteExists] = useState<boolean>(false);

	const { setFilteredVehicles, filteredVehicles, setCachedDbDataState } =
		useDataContext();
	const intervalRef = useRef<NodeJS.Timeout>();

	const checkIfRouteExists = useCallback(
		(route: string) => {
			setRouteExists(allRoutes?.some((r) => r === route));
			return allRoutes?.some((r) => r === route);
		},
		[allRoutes],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: < didn't work without >
	const handleOnChange = useCallback(
		debounce(async (query: string) => {
			const routeExists = checkIfRouteExists(query);
			if (!routeExists) {
				console.log("Route does not exist");
				return;
			}
			setFilteredVehicles(await getFilteredVehiclePositions(query));
		}, 250),
		[checkIfRouteExists],
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
	const handleCachedDbData = useCallback(async () => {
		const cachedDbData = await getCachedDbData(userInput);
		setCachedDbDataState(cachedDbData);
	}, [userInput, setCachedDbDataState]);

	useEffect(() => {
		if (!allRoutes?.length) {
			(async () => {
				const allRoutes = await getAllRoutes();
				setAllRoutes(allRoutes);
			})();
		}
	});

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

	useEffect(() => {
		if (filteredVehicles.length) handleCachedDbData();
	}, [handleCachedDbData, filteredVehicles]);

	return (
		<>
			<div className="search-bar__container">
				<Icon path={path} fill={fill} iconSize={iconSize} title={title} />
				<input
					type="text"
					maxLength={5}
					pattern="[A-Z]{0,2}[0-9]{1,3}[A-Z]{0,2}"
					placeholder="Sök busslinje..."
					className="search-bar__input"
					onChange={(e) => setUserInput(e.target.value.toUpperCase())}
					value={userInput}
					style={{
						outlineColor: routeExists ? colors.accentColor : colors.notValid,
					}}
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
