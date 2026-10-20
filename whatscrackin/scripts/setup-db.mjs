// Creates the tables, default settings, Orlando as the first live city, and the owner account.
// Usage: DATABASE_URL=... OWNER_EMAIL=you@example.com npm run db:setup
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
const owner = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
if (!url) {
  console.error('Set DATABASE_URL first.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await sql.unsafe(schema);

  const defaults = { default_goal: '100', reveal_pct: '75', suggest_from_breweries: 'true' };
  for (const [key, value] of Object.entries(defaults)) {
    await sql`insert into settings (key, value) values (${key}, ${value}) on conflict (key) do nothing`;
  }

  await sql`
    insert into cities (slug, name, state, status, lat, lng, beehiiv_tag, launched_at)
    values ('orlando-fl', 'Orlando', 'FL', 'live', 28.5384, -81.3789, 'Orlando', now())
    on conflict (slug) do nothing`;

  if (owner) {
    await sql`insert into admins (email, role) values (${owner}, 'owner') on conflict (email) do update set role = 'owner'`;
    console.log(`Owner account: ${owner}`);
  } else {
    console.log('No OWNER_EMAIL given, so no admin was added. Re-run with OWNER_EMAIL set.');
  }
  console.log('Database ready.');
} finally {
  await sql.end();
}
