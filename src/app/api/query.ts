// import { NextResponse } from 'next/server';
// import { drizzle } from 'drizzle-orm/vercel-postgres';

import { drizzle } from "drizzle-orm/postgres-js";
import { routes } from "../db/schema/routes";

// export const GET = async () => {
//     const db = drizzle();
//     const result = await db.execute('select 1');
// return NextResponse.json({ result })
// }
// const db = drizzle(routes);
// await db.select().from(routes);
