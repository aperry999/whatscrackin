import { alertOwners } from '@/lib/alerts';
import { reply, tooMany } from '@/lib/api';
import { db, ready } from '@/lib/db';
import { cleanEmail } from '@/lib/email';

// Called by the trip planner (trips.whatscrackin.us) right after a guest starts a trip.
// No shared secret: the trip is looked up on the trip site itself, only trips created in the
// last 15 minutes count, and each trip alerts once, so a forged call can't invent a trip or repeat one.
const TRIPS_SITE = process.env.TRIPS_SITE_URL || 'https://trips.whatscrackin.us';

type Trip = { id: string; city: string; start: string; end: string; created: string };

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export async function POST(req: Request) {
  if (tooMany(req, 30)) return reply('Too many requests', 429);
  let body: { id?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply('Bad request', 400);
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[a-z0-9]{12}$/.test(id)) return reply('Bad request', 400);

  const res = await fetch(`${TRIPS_SITE}/api/trips/${id}`, { cache: 'no-store' });
  if (!res.ok) return reply('Trip not found', 404);
  const trip = (await res.json()) as Trip;
  if (!trip.created || Date.now() - Date.parse(trip.created) > 15 * 60 * 1000) return reply('Too old', 409);

  await ready();
  const fresh = await db()`insert into trip_alerts (trip_id) values (${id}) on conflict do nothing returning trip_id`;
  if (!fresh.length) return reply('Already sent');

  const days = Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 864e5) + 1;
  alertOwners(`New trip planned: ${trip.city}`, {
    Who: cleanEmail(body.email) || '(no email)',
    Where: trip.city,
    When: `${fmt(trip.start)} to ${fmt(trip.end)} (${days} day${days === 1 ? '' : 's'})`,
    'Trip page': `${TRIPS_SITE}/trip/${id}`,
  });
  return reply('Sent');
}
