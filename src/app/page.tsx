import TextBlock from "./components/Textblock";

export default async function Home() {
	return (
		<div className="wrapper__start">
			<TextBlock
				title="Var är bussen?"
				className="textblock"
				description="Undrar du också var bussen är? Här kan du se var bussen är i realtid."
			/>
		</div>
	);
}
