"use client";

import {
	getOperatorRegistryEntryBySlug,
	getOperatorSeoArea,
} from "@shared/config/operatorsRegistry";
import { getOperatorDisplayLabel } from "@shared/config/gtfsOperators";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseOperatorFromRealtimePathname, searchPathForOperator } from "../paths";
import { isLikelyLineNumberQuery } from "../utilities/searchBarHelpers";

export interface RegionOption {
	operator: string;
	regionLabel: string;
	crestIcon?: string;
}

interface UseSearchBarOperatorsParams {
	pathname: string;
	searchParams: { get: (key: string) => string | null; toString: () => string };
	router: AppRouterInstance;
	userInput: string;
	onOperatorSwitchReset: () => void;
	fetchJsonOrThrow: <T>(url: string, init?: RequestInit) => Promise<T>;
	fetchAllRoutes: (
		operator: string,
	) => Promise<{ asObject: Record<string, boolean>; asArray: string[] }>;
}

export function useSearchBarOperators({
	pathname,
	searchParams,
	router,
	userInput,
	onOperatorSwitchReset,
	fetchJsonOrThrow,
	fetchAllRoutes,
}: UseSearchBarOperatorsParams) {
	const [operatorsMeta, setOperatorsMeta] = useState<{
		operators: string[];
		defaultOperator: string;
	} | null>(null);
	const [allRoutes, setAllRoutes] = useState<{
		asObject: Record<string, boolean>;
		asArray: string[];
	}>({ asObject: {}, asArray: [] });
	const [routesLoaded, setRoutesLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const m = await fetchJsonOrThrow<{
					operators: string[];
					defaultOperator: string;
				}>("/api/operators");
				if (!cancelled) setOperatorsMeta(m);
			} catch {
				if (!cancelled) {
					setOperatorsMeta({ operators: ["sl"], defaultOperator: "sl" });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [fetchJsonOrThrow]);

	const effectiveOperator = useMemo(() => {
		const pathSlug = parseOperatorFromRealtimePathname(pathname);
		const querySlug = searchParams.get("operator")?.trim().toLowerCase() ?? "";
		if (!operatorsMeta) return (pathSlug ?? querySlug) || "";
		if (pathSlug && operatorsMeta.operators.includes(pathSlug)) return pathSlug;
		if (querySlug && operatorsMeta.operators.includes(querySlug)) return querySlug;
		return operatorsMeta.defaultOperator;
	}, [pathname, searchParams, operatorsMeta]);

	useEffect(() => {
		if (!operatorsMeta) return;
		let cancelled = false;
		void (async () => {
			setRoutesLoaded(false);
			try {
				const routes = await fetchAllRoutes(effectiveOperator);
				if (cancelled) return;
				setAllRoutes(routes);
				setRoutesLoaded(true);
			} catch {
				if (!cancelled) {
					setAllRoutes({ asObject: {}, asArray: [] });
					setRoutesLoaded(true);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [operatorsMeta, effectiveOperator, fetchAllRoutes]);

	const routeExists = useMemo(() => {
		if (!routesLoaded) return false;
		const raw = userInput.trim();
		return raw ? !!allRoutes.asObject[raw.toUpperCase()] : false;
	}, [userInput, routesLoaded, allRoutes.asObject]);

	const proposedRoute = useMemo(() => {
		if (routeExists) return "";
		const trimmed = userInput.trim();
		if (!trimmed || !isLikelyLineNumberQuery(trimmed)) return "";
		const prefix = trimmed.slice(0, -1).toUpperCase();
		return allRoutes.asArray.find((r) => r.includes(prefix)) ?? "";
	}, [userInput, routeExists, allRoutes.asArray]);

	const replaceOperatorInUrl = useCallback(
		(next: string) => {
			onOperatorSwitchReset();
			const p = new URLSearchParams(searchParams.toString());
			p.delete("operator");
			p.delete("linje");
			p.delete("mapfit");
			const qs = p.toString();
			const base = searchPathForOperator(next);
			router.replace(qs ? `${base}?${qs}` : base);
		},
		[onOperatorSwitchReset, router, searchParams],
	);

	const regionOptions = useMemo<RegionOption[]>(() => {
		const ops = operatorsMeta?.operators ?? [];
		return ops
			.map((operator) => ({
				operator,
				regionLabel:
					getOperatorSeoArea(operator) ?? getOperatorDisplayLabel(operator),
				crestIcon: getOperatorRegistryEntryBySlug(operator)?.crestIcon,
			}))
			.sort((a, b) => a.regionLabel.localeCompare(b.regionLabel, "sv"));
	}, [operatorsMeta?.operators]);

	return {
		operatorsMeta,
		effectiveOperator,
		allRoutes,
		routesLoaded,
		routeExists,
		proposedRoute,
		replaceOperatorInUrl,
		regionOptions,
	};
}
