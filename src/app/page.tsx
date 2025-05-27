import { bus } from "../../public/icons";
import DemoMap from "./components/DemoMap";
import { LinkButton } from "./components/LinkButton";
import TextBlock from "./components/Textblock";

export default async function Home() {
	return (
		<>
			<div className="wrapper__start">
				<TextBlock
					title="Min buss.nu"
					className="start"
					description="Undrar du också var bussen är? Vi visar var bussen är i realtid."
				/>
				<DemoMap />
			</div>
			<LinkButton
				title="Sök busslinje"
				text="Sök busslinje"
				fill={"black"}
				path={bus}
				className="--cta"
				href="/karta"
				id="cta"
			/>
		</>
	);
}
