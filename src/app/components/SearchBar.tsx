"use client";
import type { IDbData } from "@shared/models/IDbData";
import type { IVehicleFilterResult } from "@shared/models/IVehiclePosition";
import Form from "next/form";
import { useRouter, useSearchParams } from "next/navigation";
import {
	type FormEvent,
	type KeyboardEvent,
	Suspense,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ITripUpdate } from "@/shared/models/ITripUpdate";
import { alphabet } from "../../../public/icons";
import colors from "../colors";
import type { ITripData } from "../context/DataContext";
import { useDataContext } from "../context/DataContext";
import { type ResponseWithData, usePolling } from "../hooks/usePolling";
import { Paths } from "../paths";
import type { IError } from "../services/cacheHelper";
import { debounce } from "../utilities/debounce";
import { Icon } from "./Icon";
import SearchError from "./SearchError";

const STOP_SUGGESTION_SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;

type IStopWithRoutesRow = {
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	routes: string[];
};

/** Slår ihop rader med samma visningsnamn (olika stop_id), slår samman linjelistor. Första träffen behåller position/id. */
function mergeDuplicateStopsByName(
	stops: IStopWithRoutesRow[],
): IStopWithRoutesRow[] {
	const byName = new Map<string, IStopWithRoutesRow>();
	for (const row of stops) {
		const key = row.stop_name.trim().toLowerCase();
		const prev = byName.get(key);
		if (!prev) {
			byName.set(key, {
				...row,
				routes: [...row.routes],
			});
			continue;
		}
		const routeSet = new Set<string>([...prev.routes, ...row.routes]);
		byName.set(key, {
			...prev,
			routes: [...routeSet].sort((a, b) => a.localeCompare(b, "sv")),
		});
	}
	return [...byName.values()];
}

function stopRowToDbData(row: IStopWithRoutesRow): IDbData {
	return {
		trip_id: "",
		shape_id: "",
		route_short_name: "",
		stop_headsign: "",
		stop_id: row.stop_id,
		departure_time: "",
		stop_name: row.stop_name,
		stop_sequence: 0,
		stop_lat: row.stop_lat,
		stop_lon: row.stop_lon,
		feed_version: "",
	};
}

/**
 * Linjesök (nummer, prefix/suffix som 4B / L22): minst en siffra i strängen.
 * Utan siffror antas hållplatssök — hållplatsnamn väntas sakna siffror.
 */
function isLikelyLineNumberQuery(trimmed: string): boolean {
	return /\d/.test(trimmed);
}

async function fetchNearbyStops(lat: number, lng: number, limit = 10) {
	return fetchJsonOrThrow<{ stops: IStopWithRoutesRow[] }>(
		`/api/stops/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&limit=${limit}`,
	);
}

async function fetchStopSearch(q: string) {
	return fetchJsonOrThrow<{ stops: IStopWithRoutesRow[] }>(
		`/api/stops/search?q=${encodeURIComponent(q)}`,
	);
}

async function fetchJsonOrThrow<T>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(url, init);
	if (!res.ok) {
		throw new Error(`Request failed: ${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

async function fetchAllRoutes() {
	return await fetchJsonOrThrow<{
		asObject: Record<string, boolean>;
		asArray: string[];
	}>("/api/routes");
}

async function fetchVehicles(busline: string): Promise<IVehicleFilterResult> {
	return await fetchJsonOrThrow<IVehicleFilterResult>(
		`/api/vehicles/${encodeURIComponent(busline)}`,
	);
}

async function fetchTripUpdates(
	busline: string,
): Promise<ResponseWithData<ITripUpdate, IError>> {
	return await fetchJsonOrThrow<ResponseWithData<ITripUpdate, IError>>(
		`/api/trip-updates/${encodeURIComponent(busline)}`,
	);
}

async function fetchDbData(
	busLine: string,
	stopName?: string,
): Promise<ITripData> {
	const qs = stopName ? `?stopName=${encodeURIComponent(stopName)}` : "";
	if (!busLine) {
		return {
			currentTrips: [],
			upcomingTrips: [],
			lineStops: [],
			lineShapes: [],
		};
	}
	return await fetchJsonOrThrow<ITripData>(
		`/api/db-data/${encodeURIComponent(busLine)}${qs}`,
	);
}

async function fetchVehiclesForPolling(
	query: string,
	signal?: AbortSignal,
): Promise<IVehicleFilterResult> {
	const res = await fetch(`/api/vehicles/${encodeURIComponent(query)}`, {
		signal,
	});
	if (!res.ok) {
		throw new Error(`Request failed: ${res.status} ${res.statusText}`);
	}
	return (await res.json()) as IVehicleFilterResult;
}

async function fetchTripUpdatesForPolling(
	query: string,
	_signal?: AbortSignal,
): Promise<ResponseWithData<ITripUpdate, IError>> {
	return fetchTripUpdates(query);
}

function lineSearchUrl(
	routeCandidate: string,
	options?: { mapFit?: boolean },
): string {
	const params = new URLSearchParams();
	params.set("linje", routeCandidate);
	if (options?.mapFit) {
		params.set("mapfit", "1");
	}
	return `${Paths.Search}?${params.toString()}`;
}

function currentUrlLinjeUpper(): string {
	if (typeof window === "undefined") return "";
	return (
		new URLSearchParams(window.location.search)
			.get("linje")
			?.trim()
			.toUpperCase() ?? ""
	);
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
	const searchParams = useSearchParams();
	const linjeFromUrl = searchParams.get("linje");
	const [userInput, setUserInput] = useState<string>(
		() => linjeFromUrl?.toUpperCase() ?? "",
	);
	const [showError, setShowError] = useState(true);
	const [allRoutes, setAllRoutes] = useState<{
		asObject: Record<string, boolean>;
		asArray: string[];
	}>({ asObject: {}, asArray: [] });
	const [routeExists, setRouteExists] = useState<boolean>(false);
	const [routesLoaded, setRoutesLoaded] = useState<boolean>(false);
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

	const lineSelectionGenerationRef = useRef(0);
	const tripDataFetchedForLineRef = useRef<string>("");
	const stopSpecificTripDataKeyRef = useRef<string>("");
	const latestVehicleLineRef = useRef(userInput);

	const {
		setFilteredVehicles,
		filteredVehicles,
		setTripData,
		setFilteredTripUpdates,
		setIsLoading,
		isLoading,
		userPosition,
		isCurrentTripsOpen,
		setMapStopPreview,
		setSelectedStopForSchedule,
		selectedStopForSchedule,
		selectedStopRouteLines,
		setSelectedStopRouteLines,
	} = useDataContext();

	const [nearbyStopsList, setNearbyStopsList] = useState<IStopWithRoutesRow[]>(
		[],
	);
	const [stopSearchList, setStopSearchList] = useState<IStopWithRoutesRow[]>(
		[],
	);
	const [nearbyStopsLoading, setNearbyStopsLoading] = useState(false);
	const [stopSearchLoading, setStopSearchLoading] = useState(false);
	const prevValidLineRef = useRef<string | null>(null);

	const checkIfRouteExists = useCallback(
		(route: string) => {
			const exists = !!allRoutes.asObject[route];
			setRouteExists(exists);
			return exists;
		},
		[allRoutes],
	);

	const navigateToValidLineIfUrlDiffers = useCallback(
		(routeCandidate: string, opts?: { mapFit?: boolean }) => {
			if (!allRoutes.asObject[routeCandidate]) return;
			const urlLine = currentUrlLinjeUpper();
			if (urlLine === routeCandidate) return;
			router.replace(
				lineSearchUrl(routeCandidate, { mapFit: opts?.mapFit ?? false }),
			);
		},
		[allRoutes.asObject, router],
	);

	useEffect(() => {
		if (!routesLoaded) return;
		const raw = userInput.trim();
		if (!raw) {
			setRouteExists(false);
			setProposedRoute("");
			return;
		}
		const upper = raw.toUpperCase();
		const exists = !!allRoutes.asObject[upper];
		setRouteExists(exists);
		if (!exists) {
			if (isLikelyLineNumberQuery(raw)) {
				setShowError(true);
			} else {
				setShowError(false);
			}
		}
	}, [userInput, routesLoaded, allRoutes.asObject]);

	useEffect(() => {
		if (!allRoutes.asArray.length) {
			(async () => {
				const routes = await fetchAllRoutes();
				setAllRoutes(routes);
				setRoutesLoaded(true);
			})();
		}
	});

	const handleOnChangeRef = useRef<((query: string) => void) | null>(null);

	useEffect(() => {
		if (!routesLoaded) return;
		handleOnChangeRef.current = debounce(async (query: string) => {
			try {
				setIsLoading(true);
				const exists = checkIfRouteExists(query);
				if (!exists) {
					setIsLoading(false);
					return;
				}

				const result = await fetchVehicles(query);
				if (query !== latestVehicleLineRef.current) {
					return;
				}
				setFilteredVehicles({ data: result.data, error: result.error });

				const routeCandidate = query.trim().toUpperCase();
				if (query === latestVehicleLineRef.current) {
					navigateToValidLineIfUrlDiffers(routeCandidate, { mapFit: true });
				}

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
		}, 500);
	}, [
		checkIfRouteExists,
		navigateToValidLineIfUrlDiffers,
		setFilteredVehicles,
		setIsLoading,
		routesLoaded,
	]);

	const {
		startPolling: pollVehiclePositions,
		stopPolling: stopVehiclePolling,
	} = usePolling<IVehicleFilterResult>(
		fetchVehiclesForPolling,
		setFilteredVehicles,
		5000,
		{
			onError: () =>
				setFilteredVehicles({
					data: [],
					error: { type: "OTHER", message: "Polling failed" },
				}),
		},
	);

	const { startPolling: pollTripUpdates, stopPolling: stopPollingUpdates } =
		usePolling<ResponseWithData<ITripUpdate, IError>>(
			fetchTripUpdatesForPolling,
			(response) => {
				if (response?.data) {
					setFilteredTripUpdates(response.data);
				}
			},
			20000,
		);

	const handleCachedDbData = useCallback(async () => {
		const scheduleStopName =
			selectedStopForSchedule?.stop_name ??
			userPosition?.closestStop?.stop_name;
		const lineAtStart = userInput.trim();

		if (lineAtStart && tripDataFetchedForLineRef.current !== lineAtStart) {
			const genWhenFetchStarted = lineSelectionGenerationRef.current;
			tripDataFetchedForLineRef.current = lineAtStart;
			try {
				const { currentTrips, lineStops, lineShapes } =
					await fetchDbData(lineAtStart);

				if (genWhenFetchStarted !== lineSelectionGenerationRef.current) {
					tripDataFetchedForLineRef.current = "";
					return;
				}
				if (userInput.trim() !== lineAtStart) {
					tripDataFetchedForLineRef.current = "";
					return;
				}
				setTripData((prev) => {
					const prevLine = prev.currentTrips[0]?.route_short_name ?? "";
					const keepExistingUpcoming =
						prevLine === lineAtStart || Boolean(scheduleStopName);
					return {
						currentTrips,
						// Prevent late base-fetch writes from wiping already fetched stop-specific upcoming trips.
						upcomingTrips: keepExistingUpcoming ? prev.upcomingTrips : [],
						lineStops: lineStops ?? [],
						lineShapes: lineShapes ?? [],
					};
				});
			} catch {
				tripDataFetchedForLineRef.current = "";
			}
		}

		const stopKey =
			scheduleStopName && lineAtStart
				? `${lineAtStart}|${scheduleStopName}`
				: "";
		if (stopKey && stopSpecificTripDataKeyRef.current !== stopKey) {
			const genWhenStopFetchStarted = lineSelectionGenerationRef.current;
			try {
				const { upcomingTrips, lineShapes } = await fetchDbData(
					lineAtStart,
					scheduleStopName,
				);

				if (genWhenStopFetchStarted !== lineSelectionGenerationRef.current) {
					return;
				}
				if (userInput.trim() !== lineAtStart) {
					return;
				}
				setTripData((prev) => ({
					...prev,
					upcomingTrips: upcomingTrips ?? [],
					lineShapes: lineShapes?.length ? lineShapes : prev.lineShapes,
				}));
				stopSpecificTripDataKeyRef.current = stopKey;
			} catch {}
		}
	}, [
		userInput,
		setTripData,
		userPosition?.closestStop?.stop_name,
		selectedStopForSchedule?.stop_name,
	]);

	useEffect(() => {
		lineSelectionGenerationRef.current += 1;
		latestVehicleLineRef.current = userInput;
		tripDataFetchedForLineRef.current = "";
		stopSpecificTripDataKeyRef.current = "";
	}, [userInput]);

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

	const isTripUpdatesPollingActive = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const trimmedUi = userInput.trim();
		if (
			trimmedUi &&
			!routeExists &&
			isLikelyLineNumberQuery(trimmedUi) &&
			(filteredVehicles?.data?.length ?? 0) > 0
		) {
			setFilteredVehicles({ data: [] });
			setFilteredTripUpdates([]);
			setTripData({
				currentTrips: [],
				upcomingTrips: [],
				lineStops: [],
				lineShapes: [],
			});
			return;
		}
		if (userInput && !filteredVehicles?.data.length && !routeExists) {
			const trimmed = userInput.trim();
			if (isLikelyLineNumberQuery(trimmed)) {
				const route = findClosestRoute(userInput);
				setProposedRoute(route ?? "");
			} else {
				setProposedRoute("");
			}
			return;
		}
		if (!userInput && filteredVehicles?.data.length) {
			setFilteredVehicles({ data: [] });
			setTripData({
				currentTrips: [],
				upcomingTrips: [],
				lineStops: [],
				lineShapes: [],
			});
			setFilteredTripUpdates([]);
			setMapStopPreview(null);
			setSelectedStopForSchedule(null);
			setSelectedStopRouteLines(null);
			return;
		}
		if (!userInput) {
			setTripData({
				currentTrips: [],
				upcomingTrips: [],
				lineStops: [],
				lineShapes: [],
			});
			setFilteredTripUpdates([]);
			setMapStopPreview(null);
			setSelectedStopForSchedule(null);
			setSelectedStopRouteLines(null);
			return;
		}
		if (userInput && filteredVehicles?.data.length > 0) {
			pollVehiclePositions(userInput);

			if (!isTripUpdatesPollingActive.current) {
				isTripUpdatesPollingActive.current = true;

				(async () => {
					try {
						const response = await fetchTripUpdates(userInput);
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
			stopVehiclePolling();

			if (isTripUpdatesPollingActive.current) {
				stopPollingUpdates();
				isTripUpdatesPollingActive.current = false;
			}
		};
	}, [userInput, filteredVehicles?.data.length, routeExists]);

	useEffect(() => {
		const scheduleStopName =
			selectedStopForSchedule?.stop_name ??
			userPosition?.closestStop?.stop_name;
		const shouldFetch =
			Boolean(scheduleStopName) ||
			Boolean(filteredVehicles?.data.length) ||
			(Boolean(userInput.trim()) && routeExists);
		if (shouldFetch) {
			handleCachedDbData();
		}
	}, [
		userPosition?.closestStop?.stop_name,
		selectedStopForSchedule?.stop_name,
		filteredVehicles?.data.length,
		userInput,
		handleCachedDbData,
		routeExists,
	]);

	useLayoutEffect(() => {
		if (!linjeFromUrl) return;
		const next = linjeFromUrl.toUpperCase();
		setUserInput(next);
		latestVehicleLineRef.current = next;
		setStopSearchList([]);
		setNearbyStopsList([]);
	}, [linjeFromUrl]);

	useEffect(() => {
		if (!routesLoaded) return;
		const line = userInput.trim();
		const isValid = !!allRoutes.asObject[line];
		if (isValid) {
			if (
				prevValidLineRef.current !== null &&
				prevValidLineRef.current !== line
			) {
				const routeLines = selectedStopRouteLines;
				const keepPinnedStop =
					Boolean(selectedStopForSchedule) &&
					Boolean(routeLines?.length) &&
					(routeLines?.some((r) => r.toUpperCase() === line.toUpperCase()) ??
						false);
				if (!keepPinnedStop) {
					setSelectedStopForSchedule(null);
					setSelectedStopRouteLines(null);
					setMapStopPreview(null);
				}
			}
			prevValidLineRef.current = line;
		} else if (!line) {
			prevValidLineRef.current = null;
		}
	}, [
		userInput,
		routesLoaded,
		allRoutes.asObject,
		selectedStopForSchedule,
		selectedStopRouteLines,
		setSelectedStopForSchedule,
		setSelectedStopRouteLines,
		setMapStopPreview,
	]);

	useEffect(() => {
		const q = userInput.trim();
		if (q.length < 2 || allRoutes.asObject[q.toUpperCase()]) {
			setStopSearchList([]);
			setStopSearchLoading(false);
			return;
		}
		setStopSearchLoading(true);
		let cancelled = false;
		const t = setTimeout(async () => {
			try {
				const { stops } = await fetchStopSearch(q);
				if (cancelled) return;
				setStopSearchList(stops);
			} catch {
				if (cancelled) return;
				setStopSearchList([]);
			} finally {
				if (!cancelled) setStopSearchLoading(false);
			}
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(t);
			setStopSearchLoading(false);
		};
	}, [userInput, allRoutes]);

	useEffect(() => {
		if (!routesLoaded) return;
		if (!linjeFromUrl) return;
		const normalizedUrl = linjeFromUrl.toUpperCase();
		if (normalizedUrl !== userInput.trim().toUpperCase()) return;
		try {
			handleOnChangeRef.current?.(linjeFromUrl);
		} catch (error) {
			console.error("Error handling URL query:", error);
		}
	}, [linjeFromUrl, userInput, routesLoaded]);

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

		const loadNearby = async () => {
			setNearbyStopsLoading(true);
			const pos = userPosition
				? { lat: userPosition.lat, lng: userPosition.lng }
				: null;
			if (!pos && typeof navigator !== "undefined" && navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(
					async (p) => {
						try {
							const { stops } = await fetchNearbyStops(
								p.coords.latitude,
								p.coords.longitude,
							);
							setNearbyStopsList(stops);
						} catch {
							setNearbyStopsList([]);
						} finally {
							setNearbyStopsLoading(false);
						}
					},
					() => {
						setNearbyStopsList([]);
						setNearbyStopsLoading(false);
					},
					{ maximumAge: 60000, enableHighAccuracy: false },
				);
				return;
			}
			if (pos) {
				try {
					const { stops } = await fetchNearbyStops(pos.lat, pos.lng);
					setNearbyStopsList(stops);
				} catch {
					setNearbyStopsList([]);
				} finally {
					setNearbyStopsLoading(false);
				}
			} else {
				setNearbyStopsList([]);
				setNearbyStopsLoading(false);
			}
		};
		void loadNearby();
	};
	const handleBlur = () => {
		setIsBlurring(true);
		setTimeout(() => {
			setIsActive(false);
			setIsBlurring(false);
			setIsKeyboardLikelyOpen(false);
		}, 100);
	};

	const handleStopPick = (row: IStopWithRoutesRow) => {
		setMapStopPreview({
			stop: stopRowToDbData(row),
			routeShortNames: row.routes,
		});
		setNearbyStopsList([]);
		setStopSearchList([]);
		handleBlur();
		inputRef.current?.blur();
	};
	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const query = userInput.trim();
		if (!query) return;

		const routeCandidate = query.toUpperCase();
		if (allRoutes.asObject[routeCandidate]) {
			router.push(lineSearchUrl(routeCandidate, { mapFit: true }));
			return;
		}

		if (isLikelyLineNumberQuery(query)) {
			router.push(lineSearchUrl(routeCandidate, { mapFit: true }));
			setShowError(true);
			setMapStopPreview(null);
			handleBlur();
			return;
		}

		const firstStopSuggestion = stopsToShow[0];
		if (firstStopSuggestion) {
			handleStopPick(firstStopSuggestion);
		}
	};

	const trimmedInput = userInput.trim();
	const isTextStopSearch =
		trimmedInput.length >= 2 && !allRoutes.asObject[trimmedInput.toUpperCase()];
	const stopsToShow = useMemo(() => {
		const raw =
			isTextStopSearch && stopSearchList.length > 0
				? stopSearchList
				: nearbyStopsList;
		return mergeDuplicateStopsByName(raw);
	}, [isTextStopSearch, stopSearchList, nearbyStopsList]);
	const isStopSuggestionsLoading =
		isTextStopSearch && stopSearchLoading
			? true
			: !isTextStopSearch && nearbyStopsLoading;
	const hasStopSuggestionPanel =
		isActive && (isStopSuggestionsLoading || stopsToShow.length > 0);

	return (
		<>
			{" "}
			<div
				ref={inputContainerRef}
				className={`search-bar__container ${isActive ? "--active" : ""} ${isLoading ? "--loading" : ""} ${hasStopSuggestionPanel ? "--with-stops" : ""}`}
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
						maxLength={80}
						pattern={undefined}
						placeholder="Sök linje / hållplats..."
						className={`search-bar__input ${isLoading ? "loading" : ""}`}
						autoComplete="off"
						onChange={(e) => {
							const value = e.target.value;
							const trimmed = value.trim();
							const upper = trimmed.toUpperCase();
							if (trimmed.length <= 6 && allRoutes.asObject[upper]) {
								latestVehicleLineRef.current = upper;
								setUserInput(upper);
								handleOnChangeRef.current?.(upper);
							} else {
								latestVehicleLineRef.current = value;
								setUserInput(value);
							}
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
								latestVehicleLineRef.current = "";
								setUserInput("");
								setNearbyStopsList([]);
								setStopSearchList([]);
								setMapStopPreview(null);
								setSelectedStopForSchedule(null);
								setSelectedStopRouteLines(null);
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
				{hasStopSuggestionPanel && (
					<section
						className={`search-bar__stop-suggestions ${isStopSuggestionsLoading ? "--loading" : ""}`}
						aria-label="Hållplatser"
						aria-busy={isStopSuggestionsLoading}
					>
						{isStopSuggestionsLoading ? (
							<h2>Laddar närmaste hållplatser...</h2>
						) : (
							<h2>Närmaste hållplatser</h2>
						)}
						{isStopSuggestionsLoading ? (
							<div
								className="search-bar__stop-suggestions-skeleton"
								aria-hidden
							>
								{STOP_SUGGESTION_SKELETON_KEYS.map((rowKey) => (
									<div
										className="search-bar__stop-suggestion-skeleton"
										key={rowKey}
									>
										<span className="search-bar__stop-suggestion-skeleton__name" />
										<span className="search-bar__stop-suggestion-skeleton__routes" />
									</div>
								))}
							</div>
						) : (
							stopsToShow.map((row) => (
								<button
									key={row.stop_id}
									type="button"
									className="search-bar__stop-suggestion"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => handleStopPick(row)}
								>
									<span className="search-bar__stop-suggestion-name">
										{row.stop_name}
									</span>
									{row.routes.length > 0 && (
										<span className="search-bar__stop-suggestion-routes">
											{row.routes.join(", ")}
										</span>
									)}
								</button>
							))
						)}
					</section>
				)}
				{!routeExists &&
					userInput &&
					isLikelyLineNumberQuery(userInput.trim()) &&
					!isLoading &&
					!isCurrentTripsOpen &&
					showError && (
						<Suspense fallback={<p className="error-message">Laddar...</p>}>
							{proposedRoute ? (
								<SearchError proposedRoute={proposedRoute} />
							) : (
								<p className="error-message">Linjen finns inte. 🤷‍♂️</p>
							)}
						</Suspense>
					)}
				{routeExists &&
					userInput &&
					!filteredVehicles?.data.length &&
					!errorMessage &&
					!isLoading &&
					!isCurrentTripsOpen &&
					showError && (
						<Suspense fallback={<p className="error-message">Laddar...</p>}>
							<SearchError userInput={userInput} />
						</Suspense>
					)}
				{errorMessage &&
					routeExists &&
					userInput &&
					!isLoading &&
					!isCurrentTripsOpen &&
					showError && (
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
