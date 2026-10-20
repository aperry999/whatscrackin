import { db, ready } from './db';
import { STATES, STATE_CODES } from './states';
import type { Settings } from './settings';

export type City = {
  id: number;
  slug: string;
  name: string;
  state: string;
  status: 'live' | 'waiting';
  goal: number | null;
  brewery_count: number | null;
  lat: number | null;
  lng: number | null;
  beehiiv_tag: string | null;
  created_at: Date;
  launched_at: Date | null;
};

export type CityWithCount = City & { requests: number };

export type GoalInfo = { goal: number; source: 'custom' | 'suggested' | 'default' };

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase());
}

// Turns "tampa, florida" or "St. Petersburg FL" into a city name, state code and slug.
export function parseCityInput(raw: string): { name: string; state: string; slug: string } | { error: string } {
  const input = raw.replace(/\s+/g, ' ').trim();
  if (input.length < 3 || input.length > 80) return { error: 'Enter your city and state, like Tampa, FL.' };
  if (/[<>{}\\]|https?:/i.test(input)) return { error: 'Enter your city and state, like Tampa, FL.' };

  let name = '';
  let state = '';
  const comma = input.lastIndexOf(',');
  if (comma > 0) {
    name = input.slice(0, comma).trim();
    const st = input.slice(comma + 1).trim();
    state = resolveState(st);
  } else {
    const lower = input.toLowerCase();
    const full = Object.keys(STATES).sort((a, b) => b.length - a.length).find((s) => lower.endsWith(' ' + s));
    if (full) {
      name = input.slice(0, input.length - full.length).trim();
      state = STATES[full];
    } else {
      const parts = input.split(' ');
      const last = parts.pop() || '';
      if (STATE_CODES.has(last.toUpperCase()) && parts.length) {
        name = parts.join(' ');
        state = last.toUpperCase();
      }
    }
  }
  if (!state) return { error: 'Add your state, like Tampa, FL.' };
  name = name.replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
  if (name.length < 2) return { error: 'Enter your city and state, like Tampa, FL.' };
  name = titleCase(name);
  return { name, state, slug: `${slugify(name)}-${state.toLowerCase()}` };
}

function resolveState(s: string) {
  const up = s.toUpperCase().replace(/\./g, '');
  if (STATE_CODES.has(up)) return up;
  return STATES[s.toLowerCase()] || '';
}

// Rough rule: 8 breweries suggests about 40 requests, 80 breweries about 250.
export function suggestGoal(breweryCount: number) {
  return Math.max(30, Math.round((17 + 2.9 * breweryCount) / 5) * 5);
}

export function goalFor(city: Pick<City, 'goal' | 'brewery_count'>, s: Settings): GoalInfo {
  if (city.goal && city.goal > 0) return { goal: city.goal, source: 'custom' };
  if (s.suggestFromBreweries && city.brewery_count && city.brewery_count > 0) {
    return { goal: suggestGoal(city.brewery_count), source: 'suggested' };
  }
  return { goal: s.defaultGoal, source: 'default' };
}

export async function getCitiesWithCounts(): Promise<CityWithCount[]> {
  await ready();
  return db()<CityWithCount[]>`
    select c.*, coalesce(r.n, 0)::int as requests
    from cities c
    left join (select city_id, count(*) as n from city_requests group by city_id) r on r.city_id = c.id
    order by (c.status = 'live') desc, coalesce(r.n, 0) desc, c.name`;
}

export async function getLiveCities(): Promise<City[]> {
  await ready();
  return db()<City[]>`select * from cities where status = 'live' order by launched_at nulls last, name`;
}

export type DeckCity = { slug: string; label: string; requests: number; goal: number; pct: number };

// Waiting cities that have passed the public reveal point, closest to launch first.
export async function getPublicDeck(s: Settings, limit = 6): Promise<DeckCity[]> {
  const rows = await db()<CityWithCount[]>`
    select c.*, count(r.id)::int as requests
    from cities c join city_requests r on r.city_id = c.id
    where c.status = 'waiting'
    group by c.id`;
  return rows
    .map((c) => {
      const { goal } = goalFor(c, s);
      return { slug: c.slug, label: `${c.name}, ${c.state}`, requests: c.requests, goal, pct: Math.min(100, Math.floor((c.requests / goal) * 100)) };
    })
    .filter((c) => c.requests * 100 >= c.goal * s.revealPct)
    .sort((a, b) => b.pct - a.pct || b.requests - a.requests)
    .slice(0, limit);
}

export async function findOrCreateCity(parsed: { name: string; state: string; slug: string }): Promise<City> {
  await ready();
  const [row] = await db()<City[]>`
    insert into cities (slug, name, state) values (${parsed.slug}, ${parsed.name}, ${parsed.state})
    on conflict (slug) do update set slug = excluded.slug
    returning *`;
  return row;
}

// Picks the live city nearest the visitor (within ~80 miles), using Vercel's location headers.
export function nearestLiveCity(live: City[], lat: number | null, lng: number | null): City | null {
  if (lat == null || lng == null) return null;
  let best: City | null = null;
  let bestMiles = 80;
  for (const c of live) {
    if (c.lat == null || c.lng == null) continue;
    const miles = haversineMiles(lat, lng, c.lat, c.lng);
    if (miles < bestMiles) {
      best = c;
      bestMiles = miles;
    }
  }
  return best;
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
