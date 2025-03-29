import React from "react";
import TextBlock from "../components/Textblock";
import Image from "next/image";
import { Contact } from "../components/Contact";

export default async function InfoPage() {
	const descriptions = [
		{
			text: `Den här tjänsten är skapad för att göra bussresandet med SL, Storstockholms Lokaltrafik, lite smidigare och mer förutsägbart./ 
		Den är särskilt användbar när du står vid en hållplats och väntar på din buss, kanske under rusningstid eller i områden där bussarna inte går lika frekvent./
		Tjänsten är tänkt att ge dig en mer avslappnad och effektiv vardag som resenär – oavsett om du pendlar dagligen eller bara reser då och då./`,
			image: {},
		},

		{
			text: `
	Det är enkelt att använda tjänsten. Du söker bara på vilken busslinje du vill resa med och ser sedan var bussarna från den linjen befinner sig just nu. Bussarna representeras av gröna markörer på kartan.`,
			image: {
				src: "/markers.png",
				alt: "Karta med bussmarkörer som visar bussarnas position i realtid.",
			},
		},
		{
			text: ` 
	Klicka på valfri buss för att se detaljer som slutstation, nästa stopp, samt schemalagd ankomst till det stoppet. Om det finns en uppdaterad ankomsttid så visas även denna. Den schemlagda tiden blir då överstruken./ `,
			image: {
				src: "/details.png",
				alt: "informationsruta som visar bussdetaljer",
			},
		},
		{
			text: `
Om du vill låsa positionen till din markerade buss, klicka på "Följ buss"./
`,
			image: { src: "/follow.png", alt: "visar funktionen följ buss" },
		},
		{
			text: `
	Du kan också klicka på “Tabell” för att visa en översikt över alla pågående resor för den valda linjen som ännu inte har passerat din närmaste busshållplats. Här ser du även den beräknade ankomsttiden för varje buss./`,
			image: {
				src: "/table.png",
				alt: "visar en tabell med pågående resor för vald linje samt när de kommer till din närmaste hållplats.",
			},
		},
	];

	return (
		<>
			<section className="wrapper__info">
				<h2>Om tjänsten</h2>
				{descriptions.map((description, index) => {
					return (
						<React.Fragment key={`description-${index}`}>
							<TextBlock description={description.text} className="info" />

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
						description={`Jag heter Patrik Arell och detta är mitt examensprojekt för utbildningen Frontend Developer på Medieinstitutet i Stockholm. /
						`}
					/>
					<Contact />
				</section>
			</section>
		</>
	);
}
