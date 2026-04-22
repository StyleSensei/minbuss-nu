import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
	getConfiguredOperators,
	getOperatorDisplayLabel,
} from "@shared/config/gtfsOperators";
import {
	getRegionPathSlugForOperator,
	resolveOperatorFromRegionPathWithConfig,
} from "@shared/config/realtimeRegionPaths";
import {
	buildRealtimeMapJsonLd,
	buildRealtimeMapPageMetadata,
} from "../../realtimeMapMetadata";
import MapClient from "../MapClient";

type Props = {
	params: Promise<{ region: string }>;
	searchParams: Promise<{ linje?: string }>;
};

export function generateStaticParams() {
	const configured = getConfiguredOperators();
	const regions = new Set<string>();
	for (const op of configured) {
		regions.add(getRegionPathSlugForOperator(op));
	}
	return [...regions].map((region) => ({ region }));
}

export async function generateMetadata({
	params,
	searchParams,
}: Props): Promise<Metadata> {
	const { region } = await params;
	const r = region.trim().toLowerCase();
	const configured = getConfiguredOperators();
	const op = resolveOperatorFromRegionPathWithConfig(r, configured);
	if (!op) {
		return { title: "Sidan finns inte" };
	}
	const sp = await searchParams;
	const linje = sp.linje?.trim();
	return buildRealtimeMapPageMetadata({ operatorSlug: op, linje });
}

export default async function Page({ params, searchParams }: Props) {
	const { region } = await params;
	const r = region.trim().toLowerCase();
	const configured = getConfiguredOperators();
	const op = resolveOperatorFromRegionPathWithConfig(r, configured);
	if (!op) {
		notFound();
	}

	const sp = await searchParams;
	const line = sp.linje?.trim();
	const jsonLd = buildRealtimeMapJsonLd({ operatorSlug: op, linje: line });
	const h1 = line
		? `Busspositioner för linje ${line} – ${getOperatorDisplayLabel(op)}`
		: `Sök bussar i realtid – ${getOperatorDisplayLabel(op)}`;

	return (
		<>
			{jsonLd && (
				<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
			)}
			<h1 className="sr-only">{h1}</h1>
			<MapClient />
		</>
	);
}
