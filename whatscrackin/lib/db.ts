import postgres from 'postgres';
import { SCHEMA } from './schema';

type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { __wcSql?: Sql; __wcReady?: Promise<void> };

// One shared connection pool, created on first use so builds don't need a database.
export function db(): Sql {
  if (!globalForDb.__wcSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.__wcSql = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
  }
  return globalForDb.__wcSql;
}

// Creates the tables, default settings, Orlando, and the OWNER_EMAIL account if they're missing.
// Runs once per server instance; every step is safe to repeat.
export function ready(): Promise<void> {
  if (!globalForDb.__wcReady) {
    globalForDb.__wcReady = (async () => {
      const sql = db();
      await sql.unsafe(SCHEMA);
      const defaults: [string, string][] = [['default_goal', '100'], ['reveal_pct', '75'], ['suggest_from_breweries', 'true']];
      for (const [key, value] of defaults) {
        await sql`insert into settings (key, value) values (${key}, ${value}) on conflict (key) do nothing`;
      }
      await sql`
        insert into cities (slug, name, state, status, lat, lng, beehiiv_tag, launched_at)
        values ('orlando-fl', 'Orlando', 'FL', 'live', 28.5384, -81.3789, 'Orlando', now())
        on conflict (slug) do nothing`;
      const owner = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
      if (owner) await sql`insert into admins (email, role) values (${owner}, 'owner') on conflict (email) do nothing`;
    })().catch((err) => {
      globalForDb.__wcReady = undefined;
      throw err;
    });
  }
  return globalForDb.__wcReady;
}
