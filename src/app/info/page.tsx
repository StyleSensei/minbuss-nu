import { bus } from "../../../public/icons";
import { LinkButton } from "../components/LinkButton";
import TextBlock from "../components/Textblock";
import Image from "next/image";

export default async function InfoPage() {
	const description = {
		part1: `Den här tjänsten är skapad för att göra bussresandet med SL, Storstockholms Lokaltrafik, lite smidigare och mer förutsägbart./ 
		Den är särskilt användbar när du står vid en hållplats och väntar på din buss, kanske under rusningstid eller i områden där bussarna inte går lika frekvent./
		Tjänsten är tänkt att ge dig en mer avslappnad och effektiv vardag som resenär – oavsett om du pendlar dagligen eller bara reser då och då./`,

		part2: `
	Det är enkelt att använda tjänsten. Du söker bara på vilken busslinje du vill resa med och ser sedan var bussarna från den linjen befinner sig just nu. Bussarna representeras av gröna markörer på kartan.`,
		part3: `
	Klicka på valfri buss för att se detaljer som slutstation, nästa stopp, samt schemalagd ankomst till det stoppet./ `,
		part4: `
	Du kan även klicka på "tabell" för att se en tabell över alla bussar på linjen och när de beräknas anlända till sin slutdestination./`,
		part5: `
	Om du vill låsa positionen till din markerade buss, klicka på "följ buss"./
	`,
	};

	return (
		<>
			<div className="wrapper__info">
				<TextBlock
					title="Om oss"
					description={description.part1}
					className="info"
				/>

				<TextBlock description={description.part2} className="info" />
				<div className="info__image">
					<Image
						src="/markers.png"
						alt="visar bussmarkörer"
						fill
						objectFit="contain"
						objectPosition="left"
					/>
				</div>

				<TextBlock description={description.part3} className="info" />
				<div className="info__image">
					<Image
						src="/details.png"
						alt="visar bussdetaljer"
						fill
						objectFit="contain"
						objectPosition="left"
					/>
				</div>
				<TextBlock description={description.part4} className="info" />
				<div className="info__image">
					<Image
						src="/table.png"
						alt="visar pågående resor"
						fill
						objectFit="contain"
						objectPosition="left"
					/>
				</div>
				<TextBlock description={description.part5} className="info" />
				<div className="info__image">
					<Image
						src="/follow.png"
						alt="visar funktionen följ buss"
						fill
						objectFit="contain"
						objectPosition="left"
					/>
				</div>
			</div>
		</>
	);
}
