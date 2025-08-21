import React from "react";
import TextBlock from "../components/Textblock";
import { Contact } from "../components/Contact";
import ImageClient from "./ImageClient";
import ImageServer from "./ImageServer";

export const metadata = {
	title: "Om tjänsten",
	description: "Information om tjänsten för att följa bussar i realtid.",
};

export default async function InfoPage() {
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
	Genom att klicka på knappen längst ner i fönstret kan du toggla mellan en expanderad och en kollapsad vy av bussinformationen./ `,
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
			<section className="wrapper__info">
				<h1 className="text-4xl font-bold tracking-tight text-balance">
					Om tjänsten
				</h1>
				{descriptions.map((description, index) => {
					return (
						<React.Fragment
							key={`description-${
								// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
								index
							}`}
						>
							<TextBlock
								description={description.text}
								className="info"
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
							{description.image.src && (
								<ImageClient
									src={description.image.src}
									alt={description.image.alt}
								/>
							)}
						</React.Fragment>
					);
				})}
				<section className="presentation">
					<TextBlock
						className="presentation__text"
						descriptionId="presentation__text"
						descriptionClassName="presentation__text"
						description={`Jag heter Patrik Arell och detta är mitt examensprojekt för utbildningen Frontend Developer på Medieinstitutet i Stockholm. /
						`}
					/>
					<Contact />
				</section>
			</section>
		</>
	);
}
