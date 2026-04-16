import { useCallback, useEffect, useRef } from "react";
import type { IError } from "@/app/services/cacheHelper";

export interface ResponseWithData<T, E = IError> {
	data: T[];
	error?: E;
}

export function usePolling<T>(
	fetchFn: (query: string, signal?: AbortSignal) => Promise<T>,
	onData: (data: T) => void,
	intervalMs: number,
	options?: {
		onError?: (error: unknown) => void;
	},
) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const queryRef = useRef<string>("");
	const intervalMsRef = useRef(intervalMs);
	const onErrorRef = useRef(options?.onError);

	intervalMsRef.current = intervalMs;
	onErrorRef.current = options?.onError;

	const executeFetch = useCallback(async () => {
		if (!queryRef.current) return;
		if (typeof document !== "undefined" && document.hidden) return;

		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		abortControllerRef.current = new AbortController();

		try {
			const data = await fetchFn(
				queryRef.current,
				abortControllerRef.current.signal,
			);
			onData(data);
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}
			onErrorRef.current?.(error);
		}
	}, [fetchFn, onData]);

	const startIntervalIfVisible = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (typeof document !== "undefined" && document.hidden) {
			return;
		}
		intervalRef.current = setInterval(executeFetch, intervalMsRef.current);
	}, [executeFetch]);

	const startPolling = useCallback(
		(query: string) => {
			queryRef.current = query;
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			if (typeof document !== "undefined" && document.hidden) {
				return;
			}
			void executeFetch();
			startIntervalIfVisible();
		},
		[executeFetch, startIntervalIfVisible],
	);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		queryRef.current = "";
	}, []);

	useEffect(() => {
		const onVis = () => {
			if (!queryRef.current) return;
			if (document.hidden) {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
				abortControllerRef.current?.abort();
				return;
			}
			void executeFetch();
			startIntervalIfVisible();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			document.removeEventListener("visibilitychange", onVis);
		};
	}, [executeFetch, startIntervalIfVisible]);

	return { startPolling, stopPolling };
}
