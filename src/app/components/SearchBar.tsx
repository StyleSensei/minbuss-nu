"use client";
import {
	type KeyboardEvent,
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Icon } from "./Icon";
import Form from "next/form";
import { getFilteredVehiclePositions } from "../actions/filterVehicles";
import { getFilteredTripUpdates } from "../actions/filterTripUpdates";
import { useDataContext } from "../context/DataContext";
import { getCachedDbData } from "../services/cacheHelper";
import { getAllRoutes } from "../actions/getAllRoutes";
import { debounce } from "../utilities/debounce";
import colors from "../colors.module.scss";
import { usePoll } from "../hooks/usePoll";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import type { ITripUpdate } from "../models/ITripUpdate";
const RouteNotFound = lazy(() => import("./RouteNotFound"));
const NotInTraffic = lazy(() => import("./NotInTraffic"));

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
	const [proposedRoute, setProposedRoute] = useState<string | undefined>("");
	const [loading, setLoading] = useState<boolean>(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const inputContainerRef = useRef<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);

	const {
		setFilteredVehicles,
		filteredVehicles,
		setCachedDbDataState,
		setFilteredTripUpdates,
		filteredTripUpdates,
	} = useDataContext();

	const checkIfRouteExists = useCallback(
		(route: string) => {
			setRouteExists(allRoutes?.some((r) => r === route));
			if (!routeExists) {
			}
			return allRoutes?.some((r) => r === route);
		},
		[allRoutes, routeExists],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: < didn't work without >
	const handleOnChange = useCallback(
		debounce(async (query: string) => {
			setLoading(true);
			const routeExists = checkIfRouteExists(query);
			if (!routeExists) setLoading(false);

			setFilteredVehicles(await getFilteredVehiclePositions(query));
			setLoading(false);
		}, 500),
		[checkIfRouteExists],
	);

	const { pollOnInterval: pollBusPositionsEveryTwoSeconds, stopPolling } =
		usePoll(
			setFilteredVehicles as (data: IVehiclePosition[]) => void,
			getFilteredVehiclePositions,
			2000,
		);

	const { pollOnInterval: pollTripUpdates } = usePoll(
		setFilteredTripUpdates as (data: ITripUpdate[]) => void,
		getFilteredTripUpdates,
		15000,
	);

	const handleCachedDbData = useCallback(async () => {
		const cachedDbData = await getCachedDbData(userInput);
		setCachedDbDataState(cachedDbData);
	}, [userInput, setCachedDbDataState]);

	const findClosestRoute = useCallback(
		(query: string) => {
			if (!query.length) return;
			if (!routeExists) {
				const closestRoute = allRoutes.find((r) =>
					r.includes(query.slice(0, query.length - 1)),
				);
				return closestRoute;
			}
		},
		[allRoutes, routeExists],
	);

	useEffect(() => {
		if (!allRoutes?.length) {
			(async () => {
				const allRoutes = await getAllRoutes();
				setAllRoutes(allRoutes);
			})();
		}
	});

	useEffect(() => {
		if (userInput && !filteredVehicles?.length && !routeExists) {
			if (!routeExists) {
				const route = findClosestRoute(userInput);
				setProposedRoute(route);
				return;
			}
		}
		if (!userInput) {
			setFilteredVehicles([]);
		}
		if (userInput && filteredVehicles?.length) {
			pollBusPositionsEveryTwoSeconds(userInput);
			pollTripUpdates(userInput);
		}

		return () => {
			stopPolling();
		};
	}, [
		userInput,
		filteredVehicles?.length,
		pollBusPositionsEveryTwoSeconds,
		setFilteredVehicles,
		routeExists,
		findClosestRoute,
		stopPolling,
		pollTripUpdates,
	]);

	useEffect(() => {
		if (filteredVehicles.length) {
			handleCachedDbData();
		}
	}, [handleCachedDbData, filteredVehicles]);

	const handleKeydown = (event: KeyboardEvent) => {
		if (
			event.key === "Escape" ||
			event.key === "Cancel" ||
			event.key === "Enter"
		) {
			inputRef.current?.blur();
			handleBlur();
		}
	};
	useEffect(() => {
		if (inputContainerRef.current?.classList.contains("--active")) {
			overlayRef.current?.classList.add("--active");
		}
	});
	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.setAttribute("readonly", "readonly");
			const timeout = setTimeout(() => {
				inputRef.current?.removeAttribute("readonly");
				inputRef.current?.focus();
			}, 300);
			return () => clearTimeout(timeout);
		}
	}, []);

	const handleFocus = () => {
		inputContainerRef.current?.classList.add("--active");
		overlayRef.current?.classList.add("--active");
	};
	const handleBlur = () => {
		inputContainerRef.current?.classList.remove("--active");
		overlayRef.current?.classList.remove("--active");
	};

	return (
		<>
			<div
				ref={inputContainerRef}
				className={
					inputRef.current?.focus
						? "search-bar__container --active"
						: "search-bar__container"
				}
			>
				<Form action="/search" onSubmit={(e) => e.preventDefault()}>
					<Icon path={path} fill={fill} iconSize={iconSize} title={title} />
					<label htmlFor="searchbar" className="sr-only">
						Sök busslinje
					</label>
					<input
						id="searchbar"
						name="searchbar"
						ref={inputRef}
						type="search"
						maxLength={5}
						pattern="[A-Z]{0,2}[0-9]{1,3}[A-Z]{0,2}"
						placeholder="Sök busslinje..."
						className="search-bar__input"
						onChange={(e) => {
							setUserInput(e.target.value.toUpperCase());
							handleOnChange(e.target.value.toUpperCase());
						}}
						value={userInput}
						onKeyDown={handleKeydown}
						onFocus={handleFocus}
						onBlur={handleBlur}
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
							<Icon
								path={path2}
								fill={fill}
								iconSize={iconSize}
								title={title2}
							/>
						</button>
					)}
					<button type="submit">Sök</button>
				</Form>
				{!routeExists && userInput && proposedRoute && !loading && (
					<Suspense fallback={<p className="error-message">Laddar...</p>}>
						<RouteNotFound proposedRoute={proposedRoute} />
					</Suspense>
				)}
				{routeExists && userInput && !filteredVehicles.length && !loading && (
					<Suspense fallback={<p className="error-message">Laddar...</p>}>
						<NotInTraffic userInput={userInput} />
					</Suspense>
				)}{" "}
			</div>
			<div ref={overlayRef} className="overlay">
				{" "}
			</div>
		</>
	);
};
