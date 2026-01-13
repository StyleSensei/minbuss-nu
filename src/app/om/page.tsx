import React from "react";
import TextBlock from "../components/Textblock";
import { Contact } from "../components/Contact";
import ImageServer from "./ImageServer";
import DemoMap from "../components/DemoMap";
import { ClientWrapper } from "../components/ClientWrapper";

export const metadata = {
	title: "Om tjänsten",
	description: "Information om tjänsten för att följa bussar i realtid.",
};

export default async function InfoPage() {
	const routePathD =
		"M-24.528,330.81399C-17.525,311.80799,-47.114,326.761,21.3,301.136,69.343,283.124,112.044,305.12,147.377,320.828,174.03,332.668,269.735,287.125,320.754,307.592,371.05,327.769,457.168,365.24,536.982,210.059,564.28,156.88,558.632,77.685,654.51,59.388,713.594,48.112,882.869,82.798,919.744,57.848";
	const customPathForMobile =
		"M-30,105.54899C7.475,86.54299,-22.114,101.496,46.3,75.871,94.343,57.859,137.044,79.855,172.377,95.563,199.03,107.403,294.735,61.86,345.754,82.327,396.05,102.504,501.08,61.971,564.379,58.233,617.898,55.06,648.459,49.572,744.353,31.302,803.43,20,964.042,59.623,1030.917,34.687";
	const descriptions = [
		{
			h2: "Varför denna tjänst?",
			text: `Den här tjänsten är skapad för att göra bussresandet med SL, Storstockholms Lokaltrafik, lite smidigare och mer förutsägbart./ 
		Den är särskilt användbar när du står vid en hållplats och väntar på din buss, kanske under rusningstid eller i områden där bussarna inte går lika frekvent./
		Tjänsten är tänkt att ge dig en mer avslappnad och effektiv vardag som resenär – oavsett om du pendlar dagligen eller bara reser då och då./`,
			image: {},
		},

		{
			h2: "Sök och visa bussar",
			text: `
	Det är enkelt att använda tjänsten. Du söker bara på vilken busslinje du vill resa med och ser sedan var bussarna från den linjen befinner sig just nu. Bussarna representeras av gröna markörer på kartan.`,
			image: {
				src: "/markers.webp",
				alt: "Karta över Stockholm med gröna markörer som visar bussarnas realtidsposition.",
			},
		},
		{
			h2: "Bussdetaljer",
			text: ` 
	Klicka på valfri buss för att se detaljer som slutstation, kommande stopp, samt schemalagd ankomst till stoppen. Om det finns en uppdaterad ankomsttid så visas även denna. Den schemalagda tiden blir då överstruken./ `,
			image: {
				src: "/collapsed-info-table.webp",
				alt: "visar detaljer om vald buss, inklusive slutstation och kommande stopp.",
			},
		},
		{
			h2: "Expanderad vy",
			text: ` 
	Genom att klicka på knappen längst ner i fönstret kan du, om du använder en mobil enhet, toggla mellan en expanderad och en kollapsad vy av bussinformationen./ `,
			image: {
				src: "/expanded-info-table.webp",
				alt: "Expanderad vy om vald buss, inklusive slutstation och kommande stopp.",
			},
		},
		{
			h2: "Följ bussen på kartan",
			text: `
Om du vill låsa positionen till din markerade buss och följa bussen på kartan, klicka på "Följ buss"./
`,
			image: { src: "/follow-bus.webp", alt: "visar funktionen följ buss" },
		},
		{
			h2: "Hållplatstabell",
			text: `
	Du kan även klicka på “Tabell” för att se en översikt över alla pågående resor och de som avgår inom sex timmar från din närmaste hållplats för den valda linjen, så länge de ännu inte har passerat hållplatsen. Här visas också den beräknade ankomsttiden för varje buss./`,
			image: {
				src: "/stop-table.webp",
				alt: "Tabell med pågående resor för vald busslinje och avgångstider från din närmaste hållplats.",
			},
		},
	];

	return (
		<>
			<article className="wrapper__info">
				<ClientWrapper>
					<section className="h1-section">
						<h1 className="font-bold tracking-tight text-balance heading text-center">
							Om <span className="text-accent">minbuss.nu</span>
						</h1>
					</section>
				</ClientWrapper>
				{descriptions.map((description, index) => {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<ClientWrapper key={`description-wrapper-${index}`}>
							<section className="xl:flex align-items-center">
								<TextBlock
									description={description.text}
									className="info server-textblock"
									h2={description.h2}
									h2ClassName="text-2xl font-bold tracking-tight text-balance text-left"
									h1ClassName="text-4xl font-bold tracking-tight text-balance"
								/>

								{description.image.src && (
									<ImageServer
										src={description.image.src}
										alt={description.image.alt}
									/>
								)}
							</section>
							{index === 0 && (
								<DemoMap
									pathD={customPathForMobile || routePathD}
									popupClass="--hidden"
									className="about-page"
									customPathForMobile={customPathForMobile}
								/>
							)}
						</ClientWrapper>
					);
				})}
				<ClientWrapper>
					<section className="presentation">
						<TextBlock
							className="presentation__text"
							descriptionId="presentation__text"
							descriptionClassName="presentation__text"
							description={`Jag heter Patrik och arbetar som webbutvecklare i Stockholm. Om du har några frågor, förslag eller feedback om tjänsten, tveka inte att ta kontakt. /
							Jag är alltid öppen för att höra från användare och förbättra tjänsten baserat på era behov./
							Tack för att du använder minbuss.nu! /
							`}
						/>
						<Contact />
						<TextBlock
							className="presentation__text--footer"
							descriptionId="presentation__text--footer"
							descriptionClassName="presentation__text--footer"
							description={`Tjänsten använder öppna trafikdata som tillhandahålls via Trafiklab, inklusive både statiska tidtabellsdata (GTFS) och realtidsdata (GTFS-RT). Datan är licensierad under CC0 1.0 (Public Domain Dedication) och bearbetas samt presenteras av minbuss.nu.
								Trafikdata kan vara fördröjd eller ofullständig och bör ses som vägledande.`}
						/>
					</section>
				</ClientWrapper>
			</article>
		</>
	);
}
