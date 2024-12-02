import { routes } from "./db/schema/routes";
import { trips } from "./db/schema/trips";
import styles from "./page.module.css";
import { extractZip } from "./services/dataProcessors/extractZip";
import { getVehiclePositions } from "./services/dataSources/gtfsRealtime";
import { getStaticData } from "./services/dataSources/gtfsStatic";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export default async function Home() {
	const vehiclePositions = await getVehiclePositions();
	// await getStaticData();

	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}
	const queryClient = postgres(process.env.DATABASE_URL);
	const db = drizzle({ client: queryClient });
	// const result = await db.execute("select 1");
	// console.log(result);
	// const routesindb = await db.select().from(routes);
	// console.log(routesindb);

	// const tripsindb = await db.select().from(trips);
	// console.log(tripsindb);

	// extractZip();
	return (
		<div className={styles.page}>
			<h1>Vehicle positions</h1>
			<ul>
				{vehiclePositions.map((vehicle) => (
					<li key={vehicle.vehicle.id}>
						Vehicle ID: {vehicle.vehicle.id} - Position:{" "}
						{vehicle.position.latitude}, {vehicle.position.longitude}
					</li>
				))}
			</ul>
		</div>
	);
}
