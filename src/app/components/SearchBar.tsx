"use client";
import {
	type FormEvent,
	type KeyboardEvent,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Icon } from "./Icon";
import Form from "next/form";
import {
	getFilteredVehiclePositions,
	type IVehicleFilterResult,
	type VehicleError,
} from "../actions/filterVehicles";
import { getFilteredTripUpdates } from "../actions/filterTripUpdates";
import { useDataContext } from "../context/DataContext";
import { getAllRoutes } from "../actions/getAllRoutes";
import { debounce } from "../utilities/debounce";
import colors from "../colors";
import { type ResponseWithData, usePoll } from "../hooks/usePoll";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import SearchError from "./SearchError";
import { alphabet } from "../../../public/icons";
import { fetchCachedDbData } from "../actions/fetchCachedDbData";
import type { ITripUpdate } from "@/shared/models/ITripUpdate";
import type { IError } from "../services/cacheHelper";
import { useRouter, useSearchParams } from "next/navigation";
import { Paths } from "../paths";

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
	const searchParams = useSearchParams();
	const [userInput, setUserInput] = useState<string>(
		encodeURIComponent(searchParams.get("linje") || "")
	);
	const [showError, setShowError] = useState(true);
	const [allRoutes, setAllRoutes] = useState<{
		asObject: Record<string, boolean>;
		asArray: string[];
	}>({ asObject: {}, asArray: [] });
	const [routeExists, setRouteExists] = useState<boolean>(false);
	const [proposedRoute, setProposedRoute] = useState<string | undefined>("");
	const inputRef = useRef<HTMLInputElement | null>(null);
	const inputContainerRef = useRef<HTMLDivElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isTextMode, setIsTextMode] = useState<boolean>(false);
	const [isKeyboardLikelyOpen, setIsKeyboardLikelyOpen] = useState(false);
	const initialHeight = useRef<number | null>(null);
	const [isActive, setIsActive] = useState(false);
	const [isBlurring, setIsBlurring] = useState(false);
	const router = useRouter();

	const {
		setFilteredVehicles,
		filteredVehicles,
		setTripData,
		setFilteredTripUpdates,
		setIsLoading,
		isLoading,
	} = useDataContext();

	const checkIfRouteExists = useCallback(
		(route: string) => {
			const exists = !!allRoutes.asObject[route];
			setRouteExists(exists);
			return exists;
		},
		[allRoutes],
	);

	const { userPosition } = useDataContext();

	// biome-ignore lint/correctness/useExhaustiveDependencies: < didn't work without >
	const handleOnChange = useCallback(
		debounce(async (query: string) => {
			try {
				setIsLoading(true);
				const routeExists = checkIfRouteExists(query);
				if (!routeExists) setIsLoading(false);

				const result = await getFilteredVehiclePositions(query);
				setFilteredVehicles({ data: result.data, error: result.error });

				if (result.error) {
					if (
						result.error.type === "DATA_TOO_OLD" &&
						"timestampAge" in result.error
					) {
						const { minutes, seconds, hours } = result.error.timestampAge;
						const ageDisplay = hours
							? `${hours}h ${minutes % 60}m ${seconds % 60}s`
							: `${minutes}m ${seconds % 60}s`;

						console.warn(
							`${result.error.message} (ålder: ${ageDisplay})`,
							"Läs mer: https://status.trafiklab.se/sv",
						);
					} else {
						console.warn(
							result.error.message,
							"Läs mer: https://status.trafiklab.se/sv",
						);
					}
					setErrorMessage(result.error.message);
				}
			} catch (error) {
				console.error("Error fetching vehicle positions:", error);
			} finally {
				setIsLoading(false);
				setShowError(true); 
			}
		}, 500),
		[checkIfRouteExists, setIsLoading],
	);

	const { pollOnInterval: pollBusPositionsEveryTwoSeconds, stopPolling } =
		usePoll<IVehiclePosition, VehicleError>(
			(response: IVehicleFilterResult) =>
				setFilteredVehicles({ data: response.data, error: response.error }),
			getFilteredVehiclePositions,
			2000,
		);

	const { pollOnInterval: pollTripUpdates, stopPolling: stopPollingUpdates } =
		usePoll<ITripUpdate, IError>(
			(response: ResponseWithData<ITripUpdate, IError>) => {
				if (response?.data) {
					setFilteredTripUpdates(response.data);
				}
			},
			getFilteredTripUpdates,
			40000,
		);

	const handleCachedDbData = useCallback(async () => {
		const { currentTrips, upcomingTrips: initialUpcomingTrips } =
			await fetchCachedDbData(userInput);

		setTripData({ currentTrips, upcomingTrips: initialUpcomingTrips || [] });

		const closestStopName = userPosition?.closestStop?.stop_name;
		if (closestStopName) {
			const { upcomingTrips } = await fetchCachedDbData(
				userInput,
				closestStopName,
			);

			if (upcomingTrips && upcomingTrips.length > 0) {
				setTripData((prev) => ({
					...prev,
					upcomingTrips,
				}));
			}
		}
	}, [userInput, setTripData, userPosition?.closestStop?.stop_name]);

	const findClosestRoute = useCallback(
		(query: string) => {
			if (!query.length) return;
			if (!routeExists) {
				const closestRoute = allRoutes.asArray.find((r) =>
					r.includes(query.slice(0, query.length - 1)),
				);
				return closestRoute;
			}
		},
		[allRoutes, routeExists],
	);

	useEffect(() => {
		if (!allRoutes.asArray.length) {
			(async () => {
				const routes = await getAllRoutes();
				setAllRoutes(routes);
			})();
		}
	});

	const isTripUpdatesPollingActive = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (userInput && !filteredVehicles?.data.length && !routeExists) {
			if (!routeExists) {
				const route = findClosestRoute(userInput);
				setProposedRoute(route);
				return;
			}
		}
		if (!userInput && filteredVehicles?.data.length) {
			setFilteredVehicles({ data: [] });
			return;
		}
		if (userInput && filteredVehicles?.data.length > 0) {
			pollBusPositionsEveryTwoSeconds(userInput);

			if (!isTripUpdatesPollingActive.current) {
				isTripUpdatesPollingActive.current = true;

				(async () => {
					try {
						const response = await getFilteredTripUpdates(userInput);
						if (response?.data) {
							setFilteredTripUpdates(response.data);
						}
					} catch (error) {
						console.error("Error getting initial trip updates:", error);
					}
				})();

				pollTripUpdates(userInput);
			}
		}

		return () => {
			stopPolling();

			if (isTripUpdatesPollingActive.current) {
				stopPollingUpdates();
				isTripUpdatesPollingActive.current = false;
			}
		};
	}, [userInput, filteredVehicles?.data.length, routeExists]);

	useEffect(() => {
		if (userPosition?.closestStop?.stop_name || filteredVehicles?.data.length) {
			handleCachedDbData();
		}
	}, [
		userPosition?.closestStop?.stop_name,
		filteredVehicles?.data.length,
		handleCachedDbData,
	]);

	useEffect(() => {
		const urlQuery = searchParams.get("linje");
		if (urlQuery && urlQuery === userInput && userInput.length > 0) {
			try {
				handleOnChange(urlQuery);
			} catch (error) {
				console.error("Error handling URL query:", error);
			}
		}
	}, [searchParams, userInput, handleOnChange]);

	const handleKeyDown = (event: KeyboardEvent) => {
		if (
			event.key === "Escape" ||
			event.key === "Cancel" ||
			event.key === "Enter"
		) {
			handleBlur();
		}
	};

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
	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (userInput.trim()) {
			router.push(`${Paths.Search}?linje=${encodeURIComponent(userInput)}`);
		}
	};

	return (
		<>
			{" "}
			<div
				ref={inputContainerRef}
				className={`search-bar__container ${isActive ? "--active" : ""} ${isLoading ? "--loading" : ""} `}
			>
				<Form action="/search" onSubmit={handleSubmit}>
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
						className={`search-bar__input ${isLoading ? "loading" : ""}`}
						autoComplete="off"
						onChange={(e) => {
							setUserInput(e.target.value.toUpperCase().trim());
							handleOnChange(e.target.value.toUpperCase().trim());
							setShowError(false); 
						}}
						value={userInput}
						onKeyDown={handleKeyDown}
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
								router.push(Paths.Search);
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
				{!routeExists && userInput && proposedRoute && !isLoading && showError && (
				  <Suspense fallback={<p className="error-message">Laddar...</p>}>
				    <SearchError proposedRoute={proposedRoute} />
				  </Suspense>
				)}
				{routeExists &&
				  userInput &&
				  !filteredVehicles?.data.length &&
				  !errorMessage &&
				  !isLoading &&
				  showError && (
				    <Suspense fallback={<p className="error-message">Laddar...</p>}>
				      <SearchError userInput={userInput} />
				    </Suspense>
				  )}
				{errorMessage && routeExists && userInput && !isLoading && showError && (
				  <Suspense fallback={<p className="error-message">Laddar...</p>}>
				    <SearchError errorText={errorMessage} />
				  </Suspense>
				)} {" "}
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
