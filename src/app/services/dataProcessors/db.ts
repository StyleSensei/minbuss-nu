import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Database instance that can be mocked in tests
let db: PostgresJsDatabase;

/**
 * Initialize the database connection
 * @param testDb Optional test database instance for testing
 * @returns The database instance
 */
export function initDb(testDb?: PostgresJsDatabase): PostgresJsDatabase {
	if (testDb) {
		db = testDb;
		return db;
	}

	if (process.env.DATABASE_URL) {
		try {
			const queryClient = postgres(process.env.DATABASE_URL);
			db = drizzle({ client: queryClient });
		} catch (error) {
			console.error("Failed to connect to database:", error);
			throw new Error("Database connection failed");
		}
	} else {
		console.warn(
			"DATABASE_URL is not defined. Database operations will be unavailable.",
		);
		throw new Error("DATABASE_URL is not defined");
	}

	return db;
}

export function getDb(): PostgresJsDatabase {
	if (!db) {
		return initDb();
	}
	return db;
}
