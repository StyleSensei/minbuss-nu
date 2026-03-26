'use client';
import {
  type FormEvent,
  type KeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Icon } from './Icon';
import Form from 'next/form';
import { type IVehicleFilterResult } from '@shared/models/IVehiclePosition';
import { useDataContext } from '../context/DataContext';
import { debounce } from '../utilities/debounce';
import colors from '../colors';
import { type ResponseWithData, usePolling } from '../hooks/usePolling';
import SearchError from './SearchError';
import { alphabet } from '../../../public/icons';
import type { ITripUpdate } from '@/shared/models/ITripUpdate';
import type { IError } from '../services/cacheHelper';
import { useRouter, useSearchParams } from 'next/navigation';
import { Paths } from '../paths';
import type { ITripData } from '../context/DataContext';

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
  }>('/api/routes');
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
  const qs = stopName ? `?stopName=${encodeURIComponent(stopName)}` : '';
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
  fill = 'whitesmoke',
  title,
  path,
  title2,
  path2,
}: SearchBarProps) => {
  const searchParams = useSearchParams();
  const [userInput, setUserInput] = useState<string>(
    encodeURIComponent(searchParams.get('linje') || ''),
  );
  const [showError, setShowError] = useState(true);
  const [allRoutes, setAllRoutes] = useState<{
    asObject: Record<string, boolean>;
    asArray: string[];
  }>({ asObject: {}, asArray: [] });
  const [routeExists, setRouteExists] = useState<boolean>(false);
  const [routesLoaded, setRoutesLoaded] = useState<boolean>(false);
  const [proposedRoute, setProposedRoute] = useState<string | undefined>('');
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
  const tripDataFetchedForLineRef = useRef<string>('');
  const stopSpecificTripDataKeyRef = useRef<string>('');
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
  } = useDataContext();

  const checkIfRouteExists = useCallback(
    (route: string) => {
      const exists = !!allRoutes.asObject[route];
      setRouteExists(exists);
      return exists;
    },
    [allRoutes],
  );
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

        if (result.error) {
          if (
            result.error.type === 'DATA_TOO_OLD' &&
            'timestampAge' in result.error
          ) {
            const { minutes, seconds, hours } = result.error.timestampAge;
            const ageDisplay = hours
              ? `${hours}h ${minutes % 60}m ${seconds % 60}s`
              : `${minutes}m ${seconds % 60}s`;

            console.warn(
              `${result.error.message} (ålder: ${ageDisplay})`,
              'Läs mer: https://status.trafiklab.se/sv',
            );
          } else {
            console.warn(
              result.error.message,
              'Läs mer: https://status.trafiklab.se/sv',
            );
          }
          setErrorMessage(result.error.message);
        }
      } catch (error) {
        console.error('Error fetching vehicle positions:', error);
      } finally {
        setIsLoading(false);
        setShowError(true);
      }
    }, 500);
  }, [checkIfRouteExists, setFilteredVehicles, setIsLoading]);

  const {
    startPolling: pollVehiclePositions,
    stopPolling: stopVehiclePolling,
  } = usePolling<IVehicleFilterResult>(
    fetchVehiclesForPolling,
    setFilteredVehicles,
    4000,
    {
      onError: () =>
        setFilteredVehicles({
          data: [],
          error: { type: 'OTHER', message: 'Polling failed' },
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
    const closestStopName = userPosition?.closestStop?.stop_name;
    const lineAtStart = userInput.trim();

    if (lineAtStart && tripDataFetchedForLineRef.current !== lineAtStart) {
      const genWhenFetchStarted = lineSelectionGenerationRef.current;
      tripDataFetchedForLineRef.current = lineAtStart;
      try {
        const { currentTrips, lineStops, lineShapes } = await fetchDbData(
          lineAtStart,
        );

        if (genWhenFetchStarted !== lineSelectionGenerationRef.current) {
          tripDataFetchedForLineRef.current = '';
          return;
        }
        if (userInput.trim() !== lineAtStart) {
          tripDataFetchedForLineRef.current = '';
          return;
        }
        setTripData({
          currentTrips,
          upcomingTrips: [],
          lineStops: lineStops ?? [],
          lineShapes: lineShapes ?? [],
        });
      } catch {
        tripDataFetchedForLineRef.current = '';
      }
    }

    const stopKey =
      closestStopName && lineAtStart ? `${lineAtStart}|${closestStopName}` : '';
    if (stopKey && stopSpecificTripDataKeyRef.current !== stopKey) {
      const genWhenStopFetchStarted = lineSelectionGenerationRef.current;
      try {
        const { upcomingTrips, lineShapes } = await fetchDbData(
          lineAtStart,
          closestStopName,
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
  }, [userInput, setTripData, userPosition?.closestStop?.stop_name, filteredVehicles?.data?.length]);

  useEffect(() => {
    lineSelectionGenerationRef.current += 1;
    latestVehicleLineRef.current = userInput;
    tripDataFetchedForLineRef.current = '';
    stopSpecificTripDataKeyRef.current = '';
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
    if (userInput && !filteredVehicles?.data.length && !routeExists) {
      if (!routeExists) {
        const route = findClosestRoute(userInput);
        setProposedRoute(route);
        return;
      }
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
            console.error('Error getting initial trip updates:', error);
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
    const shouldFetch =
      Boolean(userPosition?.closestStop?.stop_name) ||
      Boolean(filteredVehicles?.data.length) ||
      (Boolean(userInput.trim()) && routeExists);
    if (shouldFetch) {
      handleCachedDbData();
    }
  }, [
    userPosition?.closestStop?.stop_name,
    filteredVehicles?.data.length,
    routeExists,
    userInput,
    handleCachedDbData,
  ]);

  useEffect(() => {
    if (!routesLoaded) return;
    const urlQuery = searchParams.get('linje');
    if (urlQuery && urlQuery === userInput && userInput.length > 0) {
      try {
        handleOnChangeRef.current?.(urlQuery);
      } catch (error) {
        console.error('Error handling URL query:', error);
      }
    }
  }, [searchParams, userInput, routesLoaded]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === 'Escape' ||
      event.key === 'Cancel' ||
      event.key === 'Enter'
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
    if (typeof window === 'undefined' || !window.visualViewport) return;

    window.visualViewport.addEventListener(
      'resize',
      handleVisualViewPortResize,
    );
    return () =>
      window?.removeEventListener('resize', handleVisualViewPortResize);
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
      {' '}
      <div
        ref={inputContainerRef}
        className={`search-bar__container ${isActive ? '--active' : ''} ${isLoading ? '--loading' : ''} `}
      >
        <Form action='/search' onSubmit={handleSubmit}>
          <button
            type='button'
            onClick={() => {
              inputRef.current?.focus();
              handleFocus();
            }}
          >
            <Icon path={path} fill={fill} iconSize={iconSize} title={title} />
          </button>
          <label htmlFor='searchbar' className='sr-only'>
            Sök busslinje
          </label>
          <input
            id='searchbar'
            name='searchbar'
            inputMode={isTextMode ? 'text' : 'numeric'}
            ref={inputRef}
            type='search'
            maxLength={5}
            pattern='[A-Z]{0,2}[0-9]{1,3}[A-Z]{0,2}'
            placeholder='Sök busslinje...'
            className={`search-bar__input ${isLoading ? 'loading' : ''}`}
            autoComplete='off'
            onChange={(e) => {
              const value = e.target.value.toUpperCase().trim();
              latestVehicleLineRef.current = value;
              setUserInput(value);
              handleOnChangeRef.current?.(value);
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
              type='button'
              className={
                isTextMode ? 'button text-mode --active' : 'button text-mode'
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
                title='Ändra till textläge'
              />
            </button>
          )}
          {userInput && title2 && path2 && (
            <button
              className='reset-button'
              type='reset'
              onClick={() => {
                latestVehicleLineRef.current = '';
                setUserInput('');
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
          <button type='submit'>Sök</button>
        </Form>
        {!routeExists &&
          userInput &&
          proposedRoute &&
          !isLoading &&
          !isCurrentTripsOpen &&
          showError && (
            <Suspense fallback={<p className='error-message'>Laddar...</p>}>
              <SearchError proposedRoute={proposedRoute} />
            </Suspense>
          )}
        {routeExists &&
          userInput &&
          !filteredVehicles?.data.length &&
          !errorMessage &&
          !isLoading &&
          !isCurrentTripsOpen &&
          showError && (
            <Suspense fallback={<p className='error-message'>Laddar...</p>}>
              <SearchError userInput={userInput} />
            </Suspense>
          )}
        {errorMessage &&
          routeExists &&
          userInput &&
          !isLoading &&
          !isCurrentTripsOpen &&
          showError && (
            <Suspense fallback={<p className='error-message'>Laddar...</p>}>
              <SearchError errorText={errorMessage} />
            </Suspense>
          )}{' '}
      </div>
      <div
        ref={overlayRef}
        className={`overlay ${isActive || isBlurring ? '--active' : ''}`}
      >
        {' '}
      </div>
    </>
  );
};
