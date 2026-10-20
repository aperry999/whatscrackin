import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { __wcSql?: Sql };

// One shared connection pool, created on first use so builds don't need a database.
export function db(): Sql {
  if (!globalForDb.__wcSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.__wcSql = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
  }
  return globalForDb.__wcSql;
}
