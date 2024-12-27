import TextBlock from "../components/Textblock";

export default function InfoPage() {
	return (
		<div>
			<TextBlock
				title="Info"
				description="This is a project to show the usage of Drizzle ORM with Postgres and
				GTFS data."
				className="info"
			/>
		</div>
	);
}
