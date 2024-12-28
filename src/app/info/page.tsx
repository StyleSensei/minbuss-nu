import TextBlock from "../components/Textblock";

export default async function InfoPage() {
	return (
		<>
			<div className="wrapper__info">
				<TextBlock
					title="Info"
					description="This is a project to show the usage of Drizzle ORM with Postgres and
				GTFS data."
					className="info"
				/>
			</div>
		</>
	);
}
