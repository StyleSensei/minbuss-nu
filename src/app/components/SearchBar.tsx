'use client';
import type { IDbData } from '@shared/models/IDbData';
import type { IVehicleFilterResult } from '@shared/models/IVehiclePosition';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { getOperatorMapView } from '@/shared/config/gtfsOperators';
import type { ITripUpdate } from '@/shared/models/ITripUpdate';
import { close } from '../../../public/icons';
import type { ITripData } from '../context/DataContext';
import { useDataContext } from '../context/DataContext';
import { useSearchBarOperators } from '../hooks/useSearchBarOperators';
import { useSearchBarRealtimeData } from '../hooks/useSearchBarRealtimeData';
import { useSearchBarTripDataCache } from '../hooks/useSearchBarTripDataCache';
import { useSearchBarUi } from '../hooks/useSearchBarUi';
import {
  LINE_SEARCH_QUERY,
  lineSearchUrl,
  searchPathForOperator,
  searchUrlWithoutStop,
  STOP_SEARCH_QUERY,
  stopSearchUrl,
} from '../paths';
import type { IError } from '../services/cacheHelper';
import { appendOperatorToApiUrl } from '../utilities/appendOperatorToApiUrl';
import {
  isLikelyLineNumberQuery,
  mergeDuplicateStopsByName,
  type StopWithRoutesRow,
  stopRowToDbData,
} from '../utilities/searchBarHelpers';
import { Icon } from './Icon';
import { RegionSelect } from './RegionSelect';
import SearchError from './SearchError';
import { SearchInputRow } from './SearchInputRow';
import { StopSuggestionsPanel } from './StopSuggestionsPanel';

async function fetchNearbyStops(
  lat: number,
  lng: number,
  operator: string,
  signal?: AbortSignal,
  limit = 10,
) {
  const path = `/api/stops/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&limit=${limit}`;
  const url = appendOperatorToApiUrl(path, operator);
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as { stops: StopWithRoutesRow[] };
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
  tripIds?: string[],
  mode?: 'full' | 'meta' | 'shapes',
): Promise<ITripData> {
  const base = `/api/db-data/${encodeURIComponent(busLine)}`;
  const qs = new URLSearchParams();
  if (stopName) qs.set('stopName', stopName);
  if (operator.trim()) qs.set('operator', operator.trim());
  if (tripIds?.length) qs.set('tripIds', tripIds.join(','));
  if (mode && mode !== 'full') qs.set('mode', mode);
  const path = qs.toString() ? `${base}?${qs.toString()}` : base;
  if (!busLine) {
    return {
      currentTrips: [],
      upcomingTrips: [],
      lineStops: [],
      lineShapes: [],
    };
  }
  return await fetchJsonOrThrow<ITripData>(path, { cache: "no-store" });
}

function currentUrlLinjeUpper(): string {
  if (typeof window === 'undefined') return '';
  return (
    new URLSearchParams(window.location.search)
      .get(LINE_SEARCH_QUERY)
      ?.trim()
      .toUpperCase() ?? ''
  );
}

function ActiveSearchTag({
  label,
  title,
  onClear,
}: {
  label: string;
  title: string;
  onClear: () => void;
}) {
  return (
    <button
      type='button'
      className='search-bar__stop-tag'
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClear}
      title={title}
      aria-label={title}
    >
      <span className='search-bar__stop-tag-name'>{label}</span>
      <span className='search-bar__stop-tag-close' aria-hidden>
        <Icon path={close} fill='currentColor' iconSize='12' title='' />
      </span>
    </button>
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
  const linjeFromUrl = searchParams.get(LINE_SEARCH_QUERY);
  const hallplatsFromUrl = searchParams.get(STOP_SEARCH_QUERY)?.trim() ?? '';
  const activeLine = linjeFromUrl?.trim().toUpperCase() ?? '';
  const [userInput, setUserInput] = useState('');
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
  const searchParamsStringRef = useRef(searchParams.toString());
  searchParamsStringRef.current = searchParams.toString();

  const {
    setFilteredVehicles,
    filteredVehicles,
    setTripData,
    setFilteredTripUpdates,
    setIsLoading,
    isLoading,
    userPosition,
    isCurrentTripsOpen,
    setIsCurrentTripsOpen,
    setSelectedStopForSchedule,
    selectedStopForSchedule,
    selectedStopRouteLines,
    setSelectedStopRouteLines,
    setSelectedStopLineFilter,
    setSelectedStopPlatformFilter,
    setSelectedStopModeFilter,
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
      setSelectedStopForSchedule(null);
      setSelectedStopRouteLines(null);
      setIsCurrentTripsOpen(false);
    },
    fetchJsonOrThrow,
    fetchAllRoutes,
  });

  const { nearbyFallbackCenter, nearbyRegionBounds } = useMemo(() => {
    const mv = getOperatorMapView(effectiveOperator);
    return {
      nearbyFallbackCenter: {
        lat: mv.defaultCenter.lat,
        lng: mv.defaultCenter.lng,
      },
      nearbyRegionBounds: mv.restriction,
    };
  }, [effectiveOperator]);

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

  const vehicleTripIds = useMemo(
    () =>
      [
        ...new Set(
          (filteredVehicles?.data ?? [])
            .map((vehicle) => vehicle.trip?.tripId)
            .filter((tripId): tripId is string => Boolean(tripId)),
        ),
      ],
    [filteredVehicles?.data],
  );

  const committedLineExists =
    routesLoaded && Boolean(activeLine) && Boolean(allRoutes.asObject[activeLine]);

  const { resetGeneration } = useSearchBarTripDataCache({
    userInput: activeLine,
    effectiveOperator,
    routeExists: committedLineExists,
    vehicleTripIds,
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
    handleActivateFromGesture,
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
    nearbyFallbackCenter,
    nearbyRegionBounds,
    inputRef,
    fetchNearbyStops,
    fetchStopSearch,
  });

  const { runLineQuery } = useSearchBarRealtimeData({
    userInput: activeLine,
    effectiveOperator,
    routesLoaded,
    routeExists: committedLineExists,
    allRoutesAsObject: allRoutes.asObject,
    filteredVehiclesLength: filteredVehicles?.data.length ?? 0,
    setIsLoading,
    setFilteredVehicles,
    setFilteredTripUpdates,
    setErrorMessage,
    navigateToValidLineIfUrlDiffers,
    onLineActivated: () => {
      handleBlur();
      inputRef.current?.blur();
    },
    setSelectedStopForSchedule,
    setSelectedStopRouteLines,
    resetTripDataToEmpty,
    fetchVehicles,
    fetchTripUpdates,
    isPinnedStopMode:
      selectedStopForSchedule !== null && !linjeFromUrl,
  });

  const selectedStopIdRef = useRef(selectedStopForSchedule?.stop_id ?? null);
  selectedStopIdRef.current = selectedStopForSchedule?.stop_id ?? null;
  const prevSelectedStopIdRef = useRef<string | null>(null);

  const clearedLineForStopIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveOperator) return;
    const stopId = selectedStopForSchedule?.stop_id ?? null;
    const previousStopId = prevSelectedStopIdRef.current;
    prevSelectedStopIdRef.current = stopId;

    if (!stopId) {
      clearedLineForStopIdRef.current = null;
      if (!previousStopId) return;
      const params = new URLSearchParams(searchParamsStringRef.current);
      if (params.get(STOP_SEARCH_QUERY) !== previousStopId) return;
      router.replace(
        searchUrlWithoutStop(effectiveOperator, searchParamsStringRef.current),
      );
      return;
    }

    if (clearedLineForStopIdRef.current !== stopId) {
      clearedLineForStopIdRef.current = stopId;
      latestVehicleLineRef.current = '';
      setUserInput('');
      setShowError(false);
      resetGeneration();
      setFilteredVehicles({ data: [], error: undefined });
      setFilteredTripUpdates([]);
      resetTripDataToEmpty();
    }

    const params = new URLSearchParams(searchParamsStringRef.current);
    if (
      params.get(STOP_SEARCH_QUERY) === stopId &&
      !params.get(LINE_SEARCH_QUERY)
    ) {
      return;
    }
    router.replace(stopSearchUrl(stopId, effectiveOperator));
  }, [
    effectiveOperator,
    resetGeneration,
    resetTripDataToEmpty,
    router,
    selectedStopForSchedule?.stop_id,
    setFilteredTripUpdates,
    setFilteredVehicles,
  ]);

  useEffect(() => {
    if (!effectiveOperator || !hallplatsFromUrl) return;
    if (activeLine) {
      router.replace(
        searchUrlWithoutStop(effectiveOperator, searchParamsStringRef.current),
      );
      return;
    }
    if (selectedStopIdRef.current === hallplatsFromUrl) return;

    let cancelled = false;
    const abort = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          appendOperatorToApiUrl(
            `/api/stops/${encodeURIComponent(hallplatsFromUrl)}/routes`,
            effectiveOperator,
          ),
          { signal: abort.signal },
        );
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            router.replace(
              searchUrlWithoutStop(
                effectiveOperator,
                searchParamsStringRef.current,
              ),
            );
          }
          return;
        }
        const data = (await res.json()) as {
          stop_id: string;
          stop_name: string;
          platform_code?: string | null;
          stop_lat: number;
          stop_lon: number;
          feed_version?: string;
          routes: string[];
        };
        if (cancelled) return;
        const stopDb: IDbData = {
          trip_id: '',
          shape_id: '',
          route_short_name: '',
          stop_headsign: '',
          stop_id: data.stop_id,
          departure_time: '',
          stop_name: data.stop_name,
          platform_code: data.platform_code,
          stop_sequence: 0,
          stop_lat: data.stop_lat,
          stop_lon: data.stop_lon,
          feed_version: data.feed_version ?? '',
        };
        setSelectedStopForSchedule(stopDb);
        setSelectedStopRouteLines(
          [...data.routes].sort((a, b) => a.localeCompare(b, 'sv')),
        );
        setSelectedStopLineFilter(null);
        setSelectedStopPlatformFilter(null);
        setSelectedStopModeFilter(null);
        setIsCurrentTripsOpen(true);
      } catch (error) {
        if (cancelled || abort.signal.aborted) return;
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [
    activeLine,
    effectiveOperator,
    hallplatsFromUrl,
    router,
    setIsCurrentTripsOpen,
    setSelectedStopForSchedule,
    setSelectedStopLineFilter,
    setSelectedStopModeFilter,
    setSelectedStopPlatformFilter,
    setSelectedStopRouteLines,
  ]);

  useEffect(() => {
    latestVehicleLineRef.current = userInput;
  }, [userInput]);

  useEffect(() => {
    if (!activeLine) return;
    setUserInput((current) =>
      current.trim().toUpperCase() === activeLine ? '' : current,
    );
  }, [activeLine, userInput]);

  useEffect(() => {
    if (!routesLoaded) return;
    const line = activeLine;
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
        }
      }
      prevValidLineRef.current = line;
    } else if (!line) {
      prevValidLineRef.current = null;
    }
  }, [
    activeLine,
    routesLoaded,
    allRoutes.asObject,
    selectedStopForSchedule,
    selectedStopRouteLines,
    setSelectedStopForSchedule,
    setSelectedStopRouteLines,
  ]);

  useEffect(() => {
    if (!routesLoaded) return;
    if (!activeLine) return;
    try {
      runLineQuery(activeLine);
    } catch (error) {
      console.error('Error handling URL query:', error);
    }
  }, [activeLine, routesLoaded, runLineQuery]);

  useEffect(() => {
    if (!routesLoaded) return;
    const line = userInput.trim().toUpperCase();
    if (!line || !allRoutes.asObject[line]) return;
    runLineQuery(line);
  }, [userInput, routesLoaded, allRoutes.asObject, runLineQuery]);

  const handleStopPick = (row: StopWithRoutesRow) => {
    const stop = stopRowToDbData(row);
    const sortedRoutes = [...row.routes].sort((a, b) =>
      a.localeCompare(b, 'sv'),
    );

    setSelectedStopForSchedule(stop);
    setSelectedStopRouteLines(sortedRoutes);
    setSelectedStopLineFilter(null);
    setSelectedStopPlatformFilter(null);
    setSelectedStopModeFilter(null);
    setIsCurrentTripsOpen(true);
    setShowError(false);

    clearSuggestions();
    handleBlur();
    inputRef.current?.blur();
  };
  const handleSearchInputChange = (value: string) => {
    const trimmed = value.trim();
    const upper = trimmed.toUpperCase();
    const isKnownLine = trimmed.length <= 6 && Boolean(allRoutes.asObject[upper]);
    if (isKnownLine || (trimmed.length <= 6 && isLikelyLineNumberQuery(trimmed))) {
      setSelectedStopForSchedule(null);
      setSelectedStopRouteLines(null);
    }
    if (isKnownLine) {
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
    setSelectedStopForSchedule(null);
    setSelectedStopRouteLines(null);
    router.push(searchPathForOperator(effectiveOperator));
    handleBlur();
  };

  const handleClearSelectedStop = () => {
    setSelectedStopForSchedule(null);
    setSelectedStopRouteLines(null);
    setIsCurrentTripsOpen(false);
  };

  const handleClearLineSearch = () => {
    latestVehicleLineRef.current = '';
    setUserInput('');
    clearSuggestions();
    setShowError(false);
    if (!selectedStopForSchedule) {
      resetGeneration();
      setFilteredVehicles({ data: [], error: undefined });
      setFilteredTripUpdates([]);
      resetTripDataToEmpty();
      setIsCurrentTripsOpen(false);
      router.push(searchPathForOperator(effectiveOperator));
    } else {
      router.push(
        stopSearchUrl(selectedStopForSchedule.stop_id, effectiveOperator),
      );
    }
    handleBlur();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = userInput.trim();
    if (!query) return;

    const routeCandidate = query.toUpperCase();
    if (allRoutes.asObject[routeCandidate]) {
      setSelectedStopForSchedule(null);
      setSelectedStopRouteLines(null);
      handleBlur();
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
      handleBlur();
      return;
    }

    try {
      const rows =
        stopSearchList.length > 0
          ? stopSearchList
          : (await fetchStopSearch(query, effectiveOperator)).stops;
      const matches = mergeDuplicateStopsByName(rows);
      const normalizedQuery = query.toLocaleLowerCase('sv');
      const stop =
        matches.find(
          (row) =>
            row.stop_name.trim().toLocaleLowerCase('sv') === normalizedQuery,
        ) ?? matches[0];
      if (stop) {
        handleStopPick(stop);
      }
    } catch {
      setShowError(true);
    }
  };

  const trimmedInput = userInput.trim();
  const isTextStopSearch =
    trimmedInput.length >= 2 && !allRoutes.asObject[trimmedInput.toUpperCase()];
  const stopsToShow = useMemo(() => {
    const raw = isTextStopSearch ? stopSearchList : nearbyStopsList;
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
  const hasActiveTag =
    selectedStopForSchedule !== null || Boolean(activeLine);
  const regionCompactLayout =
    showRegionPicker && !isActive && (!userInput.trim() || Boolean(activeLine));
  const selectedStopName = selectedStopForSchedule?.stop_name?.trim() ?? '';

  return (
    <>
      <div
        className={`search-bar__layout${showRegionPicker ? ' search-bar__layout--with-region' : ''}${regionCompactLayout ? ' search-bar__layout--region-compact' : ''}${hasActiveTag ? ' search-bar__layout--with-stop-tag' : ''}`}
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
            onActivateFromGesture={handleActivateFromGesture}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
            onChangeInput={handleSearchInputChange}
            onToggleTextMode={handleToggleTextMode}
            onReset={handleReset}
          />
          {hasStopSuggestionPanel ? (
            <StopSuggestionsPanel
              isLoading={isStopSuggestionsLoading}
              isSearchMode={isTextStopSearch}
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
        {hasActiveTag ? (
          <div className='search-bar__active-tags'>
            {selectedStopForSchedule ? (
              <ActiveSearchTag
                label={selectedStopName || 'Vald hållplats'}
                title={`Avaktivera ${selectedStopName || 'hållplats'}`}
                onClear={handleClearSelectedStop}
              />
            ) : null}
            {activeLine ? (
              <ActiveSearchTag
                label={`Linje ${activeLine}`}
                title={`Avaktivera linje ${activeLine}`}
                onClear={handleClearLineSearch}
              />
            ) : null}
          </div>
        ) : null}
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
