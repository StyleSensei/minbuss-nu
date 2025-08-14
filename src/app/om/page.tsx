import React from "react";
import TextBlock from "../components/Textblock";
import Image from "next/image";
import { Contact } from "../components/Contact";

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
				src: "/markers.png",
				alt: "Karta över Stockholm med gröna markörer som visar bussarnas realtidsposition.",
			},
		},
		{
			h2: "Bussdetaljer",
			text: ` 
	Klicka på valfri buss för att se detaljer som slutstation, nästa stopp, samt schemalagd ankomst till det stoppet. Om det finns en uppdaterad ankomsttid så visas även denna. Den schemlagda tiden blir då överstruken./ `,
			image: {
				src: "/details.png",
				alt: "visar detaljer om vald buss, inklusive slutstation och nästa stopp.",
			},
		},
		{
			h2: "Följ bussen på kartan",
			text: `
Om du vill låsa positionen till din markerade buss och följa bussen på kartan, klicka på "Följ buss"./
`,
			image: { src: "/follow.png", alt: "visar funktionen följ buss" },
		},
		{
			h2: "Tabell",
			text: `
	Du kan också klicka på “Tabell” för att visa en översikt över alla pågående resor för den valda linjen som ännu inte har passerat din närmaste busshållplats. Här ser du även den beräknade ankomsttiden för varje buss./`,
			image: {
				src: "/table.png",
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
								<div className="info__image">
									<Image
										src={description.image.src}
										alt={description.image.alt}
										fill
										objectFit="contain"
										objectPosition="left"
									/>
								</div>
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
