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
import SearchError from "./SearchError";
import { alphabet } from "../../../public/icons";
import { set } from "zod";

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
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isTextMode, setIsTextMode] = useState<boolean>(false);
	const [isKeyboardLikelyOpen, setIsKeyboardLikelyOpen] = useState(false);
	const initialHeight = useRef<number | null>(null);
	const [isActive, setIsActive] = useState(false);
	const [isBlurring, setIsBlurring] = useState(false);

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

			const result = await getFilteredVehiclePositions(query);
			setFilteredVehicles(result.data);

			if (result.error) {
				console.warn(
					result.error.message,
					"Läs mer: https://status.trafiklab.se/sv",
				);
				setErrorMessage(result.error.message);
			}
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

	const { pollOnInterval: pollTripUpdates, stopPolling: stopPollingUpdates } =
		usePoll(setFilteredTripUpdates, getFilteredTripUpdates, 40000);

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
			stopPollingUpdates();
		};
	}, [
		userInput,
		filteredVehicles?.length,
		pollBusPositionsEveryTwoSeconds,
		setFilteredVehicles,
		routeExists,
		findClosestRoute,
		stopPolling,
		stopPollingUpdates,
		pollTripUpdates,
	]);

	useEffect(() => {
		if (filteredVehicles?.length) {
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
		if (inputRef.current) {
			inputRef.current.setAttribute("readonly", "readonly");
			const timeout = setTimeout(() => {
				inputRef.current?.removeAttribute("readonly");
				inputRef.current?.focus();
			}, 700);
			return () => clearTimeout(timeout);
		}
	}, []);

	const handleVisualViewPortResize = useCallback(() => {
		if (!initialHeight.current || !window.visualViewport) return;
		const keyboardOpen =
			window?.innerHeight > window?.visualViewport.height + 150;

		setIsKeyboardLikelyOpen(keyboardOpen);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined" || !window.visualViewport) return;

		window.visualViewport.addEventListener(
			"resize",
			handleVisualViewPortResize,
		);
		return () =>
			window?.removeEventListener("resize", handleVisualViewPortResize);
	}, [handleVisualViewPortResize]);

	const handleFocus = () => {
		setIsActive(true);

		const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

		if (isMobile) {
			setIsKeyboardLikelyOpen(true);
		}
	};
	const handleBlur = () => {
		setIsBlurring(true);

		setTimeout(() => {
			setIsActive(false);
			setIsBlurring(false);
			setIsKeyboardLikelyOpen(false);
		}, 100);
	};

	return (
		<>
			<div
				ref={inputContainerRef}
				className={`search-bar__container ${isActive ? "--active" : ""}`}
			>
				<Form action="/search" onSubmit={(e) => e.preventDefault()}>
					<button
						type="button"
						onClick={() => {
							inputRef.current?.focus();
							handleFocus();
						}}
					>
						<Icon path={path} fill={fill} iconSize={iconSize} title={title} />
					</button>
					<label htmlFor="searchbar" className="sr-only">
						Sök busslinje
					</label>
					<input
						id="searchbar"
						name="searchbar"
						inputMode={isTextMode ? "text" : "numeric"}
						ref={inputRef}
						type="search"
						maxLength={5}
						pattern="[A-Z]{0,2}[0-9]{1,3}[A-Z]{0,2}"
						placeholder="Sök busslinje..."
						className="search-bar__input"
						autoComplete="off"
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
					{isKeyboardLikelyOpen && (
						<button
							type="button"
							className={
								isTextMode ? "button text-mode --active" : "button text-mode"
							}
							onMouseDown={(e) => {
								e.preventDefault();
							}}
							onClick={() => {
								setIsTextMode(!isTextMode);
								inputRef.current?.focus();
							}}
						>
							<Icon
								path={alphabet}
								fill={fill}
								iconSize={iconSize}
								title="Ändra till textläge"
							/>
						</button>
					)}
					{userInput && title2 && path2 && (
						<button
							className="reset-button"
							type="reset"
							onClick={() => {
								setUserInput("");
								handleBlur();
							}}
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
						<SearchError proposedRoute={proposedRoute} />
					</Suspense>
				)}
				{routeExists &&
					userInput &&
					!filteredVehicles?.length &&
					!errorMessage &&
					!loading && (
						<Suspense fallback={<p className="error-message">Laddar...</p>}>
							<SearchError userInput={userInput} />
						</Suspense>
					)}
				{errorMessage && routeExists && userInput && !loading && (
					<Suspense fallback={<p className="error-message">Laddar...</p>}>
						<SearchError errorText={errorMessage} />
					</Suspense>
				)}{" "}
			</div>
			<div
				ref={overlayRef}
				className={`overlay ${isActive || isBlurring ? "--active" : ""}`}
			>
				{" "}
			</div>
		</>
	);
};
