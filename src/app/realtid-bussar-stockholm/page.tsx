import { Paths } from "../paths";
import MapClient from "./MapClient";

export const metadata = {
	title: "Se närmaste bussen live i Stockholm",
};

interface Props {
	searchParams: {
		line?: string;
	};
}

export default function Page({ searchParams }: Props) {
	const line = searchParams.line?.trim();
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
					url: `https://minbuss.nu/${Paths.Search}?linje=${encodeURIComponent(line)}`,
				},
			}
		: null;

	return (
		<>
			{jsonLd && (
				<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
			)}
			<MapClient />
		</>
	);
}
