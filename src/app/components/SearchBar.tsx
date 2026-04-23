'use client';
import type { IVehicleFilterResult } from '@shared/models/IVehiclePosition';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ITripUpdate } from '@/shared/models/ITripUpdate';
import type { ITripData } from '../context/DataContext';
import { useDataContext } from '../context/DataContext';
import { useSearchBarOperators } from '../hooks/useSearchBarOperators';
import { useSearchBarRealtimeData } from '../hooks/useSearchBarRealtimeData';
import { useSearchBarTripDataCache } from '../hooks/useSearchBarTripDataCache';
import { useSearchBarUi } from '../hooks/useSearchBarUi';
import { lineSearchUrl, searchPathForOperator } from '../paths';
import type { IError } from '../services/cacheHelper';
import { appendOperatorToApiUrl } from '../utilities/appendOperatorToApiUrl';
import {
  isLikelyLineNumberQuery,
  mergeDuplicateStopsByName,
  stopRowToDbData,
  type StopWithRoutesRow,
} from '../utilities/searchBarHelpers';
import { RegionSelect } from './RegionSelect';
import SearchError from './SearchError';
import { SearchInputRow } from './SearchInputRow';
import { StopSuggestionsPanel } from './StopSuggestionsPanel';

async function fetchNearbyStops(
  lat: number,
  lng: number,
  operator: string,
  limit = 10,
) {
  const path = `/api/stops/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&limit=${limit}`;
  return fetchJsonOrThrow<{ stops: StopWithRoutesRow[] }>(
    appendOperatorToApiUrl(path, operator),
  );
}

async function fetchStopSearch(q: string, operator: string) {
  const path = `/api/stops/search?q=${encodeURIComponent(q)}`;
  return fetchJsonOrThrow<{ stops: StopWithRoutesRow[] }>(
    appendOperatorToApiUrl(path, operator),
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

async function fetchAllRoutes(operator: string) {
  const path = appendOperatorToApiUrl('/api/routes', operator);
  return await fetchJsonOrThrow<{
    asObject: Record<string, boolean>;
    asArray: string[];
  }>(path);
}

async function fetchVehicles(
  busline: string,
  operator: string,
): Promise<IVehicleFilterResult> {
  const path = appendOperatorToApiUrl(
    `/api/vehicles/${encodeURIComponent(busline)}`,
    operator,
  );
  return await fetchJsonOrThrow<IVehicleFilterResult>(path);
}

async function fetchTripUpdates(
  busline: string,
  operator: string,
): Promise<ITripUpdateResponse> {
  const path = appendOperatorToApiUrl(
    `/api/trip-updates/${encodeURIComponent(busline)}`,
    operator,
  );
  return await fetchJsonOrThrow<ITripUpdateResponse>(path);
}

async function fetchDbData(
  busLine: string,
  operator: string,
  stopName?: string,
): Promise<ITripData> {
  const base = `/api/db-data/${encodeURIComponent(busLine)}`;
  const qs = new URLSearchParams();
  if (stopName) qs.set('stopName', stopName);
  if (operator.trim()) qs.set('operator', operator.trim());
  const path = qs.toString() ? `${base}?${qs.toString()}` : base;
  if (!busLine) {
    return {
      currentTrips: [],
      upcomingTrips: [],
      lineStops: [],
      lineShapes: [],
    };
  }
  return await fetchJsonOrThrow<ITripData>(path);
}

function currentUrlLinjeUpper(): string {
  if (typeof window === 'undefined') return '';
  return (
    new URLSearchParams(window.location.search)
      .get('linje')
      ?.trim()
      .toUpperCase() ?? ''
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

type ITripUpdateResponse = {
  data: ITripUpdate[];
  error?: IError;
};
export const SearchBar = ({
  iconSize,
  fill = 'whitesmoke',
  title,
  path,
  title2,
  path2,
}: SearchBarProps) => {
  const searchParams = useSearchParams();
  const linjeFromUrl = searchParams.get('linje');
  const [userInput, setUserInput] = useState<string>(
    () => linjeFromUrl?.toUpperCase() ?? '',
  );
  const [showError, setShowError] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlayPortalReady, setOverlayPortalReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setOverlayPortalReady(true);
  }, []);

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

  const resetTripDataToEmpty = useCallback(() => {
    setTripData((prev) => {
      if (
        prev.currentTrips.length === 0 &&
        prev.upcomingTrips.length === 0 &&
        prev.lineStops.length === 0 &&
        prev.lineShapes.length === 0
      ) {
        return prev;
      }
      return {
        currentTrips: [],
        upcomingTrips: [],
        lineStops: [],
        lineShapes: [],
      };
    });
  }, [setTripData]);

  const prevValidLineRef = useRef<string | null>(null);
  const {
    operatorsMeta,
    effectiveOperator,
    allRoutes,
    routesLoaded,
    routeExists,
    proposedRoute,
    replaceOperatorInUrl,
    regionOptions,
  } = useSearchBarOperators({
    pathname,
    searchParams,
    router,
    userInput,
    onOperatorSwitchReset: () => {
      latestVehicleLineRef.current = '';
      setUserInput('');
      setShowError(false);
    },
    fetchJsonOrThrow,
    fetchAllRoutes,
  });

  const navigateToValidLineIfUrlDiffers = useCallback(
    (routeCandidate: string, opts?: { mapFit?: boolean }) => {
      if (!allRoutes.asObject[routeCandidate]) return;
      const urlLine = currentUrlLinjeUpper();
      if (urlLine === routeCandidate) return;
      router.replace(
        lineSearchUrl(routeCandidate, effectiveOperator, {
          mapFit: opts?.mapFit ?? false,
        }),
      );
    },
    [allRoutes.asObject, router, effectiveOperator],
  );

  useEffect(() => {
    if (!routesLoaded) return;
    const raw = userInput.trim();
    if (!raw) return;
    if (!routeExists) {
      setShowError(isLikelyLineNumberQuery(raw));
    }
  }, [userInput, routesLoaded, routeExists]);

  const { resetGeneration } = useSearchBarTripDataCache({
    userInput,
    effectiveOperator,
    routeExists,
    filteredVehiclesLength: filteredVehicles?.data.length ?? 0,
    userClosestStopName: userPosition?.closestStop?.stop_name,
    selectedStopName: selectedStopForSchedule?.stop_name,
    setTripData,
    fetchDbData,
  });

  const prevEffectiveOperatorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!operatorsMeta || !effectiveOperator) return;
    if (prevEffectiveOperatorRef.current === null) {
      prevEffectiveOperatorRef.current = effectiveOperator;
      return;
    }
    if (prevEffectiveOperatorRef.current === effectiveOperator) return;
    prevEffectiveOperatorRef.current = effectiveOperator;
    resetGeneration();
    setFilteredVehicles({ data: [], error: undefined });
    setFilteredTripUpdates([]);
    resetTripDataToEmpty();
  }, [
    effectiveOperator,
    operatorsMeta,
    resetGeneration,
    setFilteredTripUpdates,
    setFilteredVehicles,
    resetTripDataToEmpty,
  ]);

  const {
    isTextMode,
    isKeyboardLikelyOpen,
    isActive,
    isBlurring,
    nearbyStopsList,
    stopSearchList,
    nearbyStopsLoading,
    stopSearchLoading,
    handleFocus,
    handleBlur,
    handleToggleTextMode,
    clearSuggestions,
    setNearbyStopsList,
    setStopSearchList,
  } = useSearchBarUi({
    userInput,
    effectiveOperator,
    allRoutesAsObject: allRoutes.asObject,
    userPosition: userPosition
      ? { lat: userPosition.lat, lng: userPosition.lng }
      : null,
    inputRef,
    fetchNearbyStops,
    fetchStopSearch,
  });

  const { runLineQuery } = useSearchBarRealtimeData({
    userInput,
    effectiveOperator,
    routesLoaded,
    routeExists,
    allRoutesAsObject: allRoutes.asObject,
    filteredVehiclesLength: filteredVehicles?.data.length ?? 0,
    setIsLoading,
    setFilteredVehicles,
    setFilteredTripUpdates,
    setErrorMessage,
    navigateToValidLineIfUrlDiffers,
    setMapStopPreview,
    setSelectedStopForSchedule,
    setSelectedStopRouteLines,
    resetTripDataToEmpty,
    fetchVehicles,
    fetchTripUpdates,
  });

  useEffect(() => {
    latestVehicleLineRef.current = userInput;
  }, [userInput]);

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
    if (!routesLoaded) return;
    if (!linjeFromUrl) return;
    const normalizedUrl = linjeFromUrl.toUpperCase();
    if (normalizedUrl !== userInput.trim().toUpperCase()) return;
    try {
      runLineQuery(linjeFromUrl);
    } catch (error) {
      console.error('Error handling URL query:', error);
    }
  }, [linjeFromUrl, userInput, routesLoaded, runLineQuery]);

  const handleStopPick = (row: StopWithRoutesRow) => {
    const stop = stopRowToDbData(row);
    const sortedRoutes = [...row.routes].sort((a, b) =>
      a.localeCompare(b, 'sv'),
    );
    const currentLine = currentUrlLinjeUpper();
    const currentLineServesStop =
      Boolean(currentLine) &&
      sortedRoutes.some((route) => route.toUpperCase() === currentLine);

    setSelectedStopForSchedule(stop);
    setSelectedStopRouteLines(sortedRoutes.length ? sortedRoutes : null);
    setShowError(false);
    setMapStopPreview({
      stop,
      routeShortNames: sortedRoutes,
    });

    if (sortedRoutes.length > 0 && !currentLineServesStop) {
      router.push(lineSearchUrl(sortedRoutes[0], effectiveOperator));
    }

    clearSuggestions();
    handleBlur();
    inputRef.current?.blur();
  };
  const handleSearchInputChange = (value: string) => {
    const trimmed = value.trim();
    const upper = trimmed.toUpperCase();
    if (trimmed.length <= 6 && allRoutes.asObject[upper]) {
      latestVehicleLineRef.current = upper;
      setUserInput(upper);
      runLineQuery(upper);
    } else {
      latestVehicleLineRef.current = value;
      setUserInput(value);
    }
    setShowError(false);
  };

  const handleReset = () => {
    latestVehicleLineRef.current = '';
    setUserInput('');
    clearSuggestions();
    setMapStopPreview(null);
    setSelectedStopForSchedule(null);
    setSelectedStopRouteLines(null);
    router.push(searchPathForOperator(effectiveOperator));
    handleBlur();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = userInput.trim();
    if (!query) return;

    const routeCandidate = query.toUpperCase();
    if (allRoutes.asObject[routeCandidate]) {
      router.push(
        lineSearchUrl(routeCandidate, effectiveOperator, { mapFit: true }),
      );
      return;
    }

    if (isLikelyLineNumberQuery(query)) {
      router.push(
        lineSearchUrl(routeCandidate, effectiveOperator, { mapFit: true }),
      );
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
  const isStopSuggestionsLoading = isTextStopSearch
    ? stopSearchLoading
    : nearbyStopsLoading;

  const searchErrorContent = (() => {
    if (isLoading || isCurrentTripsOpen || !showError || !userInput)
      return null;
    const trimmed = userInput.trim();
    if (!routeExists && isLikelyLineNumberQuery(trimmed)) {
      return proposedRoute ? (
        <SearchError proposedRoute={proposedRoute} />
      ) : (
        <p className='error-message'>Linjen finns inte. 🤷‍♂️</p>
      );
    }
    if (routeExists && !filteredVehicles?.data.length && !errorMessage) {
      return <SearchError userInput={userInput} />;
    }
    if (errorMessage && routeExists) {
      return <SearchError errorText={errorMessage} />;
    }
    return null;
  })();

  const hasStopSuggestionPanel =
    isActive && (isStopSuggestionsLoading || stopsToShow.length > 0);

  const showRegionPicker =
    Boolean(operatorsMeta) && (operatorsMeta?.operators.length ?? 0) > 1;
  const regionCompactLayout =
    showRegionPicker && !isActive && !userInput.trim();

  return (
    <>
      <div
        className={`search-bar__layout${showRegionPicker ? ' search-bar__layout--with-region' : ''}${regionCompactLayout ? ' search-bar__layout--region-compact' : ''}`}
      >
        <div
          ref={inputContainerRef}
          className={`search-bar__container${showRegionPicker ? ' search-bar__container--with-region' : ''} ${isActive ? '--active' : ''} ${isLoading ? '--loading' : ''} ${hasStopSuggestionPanel ? '--with-stops' : ''}`}
        >
          <SearchInputRow
            iconSize={iconSize}
            fill={fill}
            title={title}
            title2={title2}
            path={path}
            path2={path2}
            inputRef={inputRef}
            userInput={userInput}
            isTextMode={isTextMode}
            isLoading={isLoading}
            isKeyboardLikelyOpen={isKeyboardLikelyOpen}
            routeExists={routeExists}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
            onChangeInput={handleSearchInputChange}
            onToggleTextMode={handleToggleTextMode}
            onReset={handleReset}
          />
          {hasStopSuggestionPanel ? (
            <StopSuggestionsPanel
              isLoading={isStopSuggestionsLoading}
              stops={stopsToShow}
              onPick={handleStopPick}
            />
          ) : null}
          {searchErrorContent ? (
            <Suspense fallback={<p className='error-message'>Laddar...</p>}>
              {searchErrorContent}
            </Suspense>
          ) : null}
        </div>
        {showRegionPicker ? (
          <div className='search-bar__region-slot'>
            <RegionSelect
              options={regionOptions}
              selectedOperator={effectiveOperator}
              onChangeOperator={replaceOperatorInUrl}
            />
          </div>
        ) : null}
      </div>
      {overlayPortalReady
        ? createPortal(
            <div
              ref={overlayRef}
              className={`overlay ${isActive || isBlurring ? '--active' : ''}`}
              aria-hidden={!(isActive || isBlurring)}
            />,
            document.body,
          )
        : null}
    </>
  );
};
