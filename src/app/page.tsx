import { routes } from "./db/schema/routes";
import { trips } from "./db/schema/trips";
import styles from "./page.module.css";
import { extractZip } from "./services/dataProcessors/extractZip";
import { getVehiclePositions } from "./services/dataSources/gtfsRealtime";
import { getStaticData } from "./services/dataSources/gtfsStatic";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export default async function Home() {
	// const result = await db.execute("select 1");
	// console.log(result);
	// const routesindb = await db.select().from(routes);
	// console.log(routesindb);

	// const tripsindb = await db.select().from(trips);
	// console.log(tripsindb);

	// extractZip();
	return (
		<div className={styles.page}>
			<h1>Hem</h1>
		</div>
	);
}
