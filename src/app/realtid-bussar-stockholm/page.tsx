import type { Metadata } from "next";
import { Paths } from "../paths";
import MapClient from "./MapClient";
interface Props {
	searchParams: {
		linje?: string;
	};
}

// Dynamisk metadata-generering med tillgång till searchParams
export async function generateMetadata({
	searchParams,
}: Props): Promise<Metadata> {
	const params = await searchParams;
	const linje = params.linje?.trim();

	return {
		title: linje
			? `Busspositioner för linje ${linje}`
			: "Sök efter bussar i Stockholm i realtid",
		description: linje
			? `Se var bussar på linje ${linje} befinner sig i realtid i Stockholm.`
			: "Sök och hitta bussar i Stockholm i realtid med vår karttjänst.",
	};
}

export default async function Page({ searchParams }: Props) {
	const params = await searchParams;
	console.log("params", params);
	const line = params.linje?.trim();
	const jsonLd = line
		? {
				"@context": "https://schema.org",
				"@type": "BusTrip",
				name: `Busslinje ${line} – Stockholm`,
				provider: {
					"@type": "BusCompany",
					name: "SL",
					url: "https://sl.se/",
				},
				areaServed: {
					"@type": "City",
					name: "Stockholm",
					address: {
						"@type": "PostalAddress",
						addressLocality: "Stockholm",
						addressCountry: "SE",
					},
				},
				offers: {
					"@type": "Offer",
					url: `https://minbuss.nu/${Paths.Search}?linje=${encodeURIComponent(
						line,
					)}`,
				},
			}
		: null;

	return (
		<>
			{jsonLd && (
				<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
			)}
			<h1 className="sr-only">
				{line
					? `Busspositioner för linje ${line}`
					: "Sök efter bussar i Stockholm i realtid"}
			</h1>
			<MapClient />
		</>
	);
}
