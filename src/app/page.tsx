import { bus } from "../../public/icons";
import { LinkButton } from "./components/LinkButton";
import TextBlock from "./components/Textblock";

export default async function Home() {
	return (
		<>
			<div className="wrapper__start">
				<TextBlock
					title="Var är bussen?"
					className="start"
					description="Undrar du också var bussen är? Här kan du se var bussen är i realtid."
				/>
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
