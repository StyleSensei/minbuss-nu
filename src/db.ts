// import { drizzle } from 'drizzle-orm/postgres-js';
// const db = drizzle(process.env.DATABASE_URL);

// const result = await db.execute('select 1');

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}
const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });
const result = await db.execute("select 1");
console.log(result);
