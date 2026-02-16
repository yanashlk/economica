import pg from "pg";

let pool;

export function getPool() {
    if (!pool) {
        pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            max: 5,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            ssl: { rejectUnauthorized: false }
        });
    }
    return pool;
}
