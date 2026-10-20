import { readFile } from 'node:fs/promises';
import { slugify } from './cities';

// One event as produced by the existing event engine (same shape as the What's Crackin' Events page).
export type FeedEvent = {
  city: string;        // city key, e.g. "orlando"
  venue: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:MM, empty = all day
  title: string;
  cat?: string;
  link?: string;
  weekly?: boolean;
  featured?: boolean;
};

export type BoardRow = {
  key: string;
  when: string;
  title: string;
  venue: string;
  tag: string;
  featured: boolean;
  link?: string;
};

const CAT: Record<string, string> = {
  trivia_games: 'Trivia',
  live_music: 'Music',
  fitness_run_club: 'Run club',
  beer_release_tap_takeover: 'Release',
  food_truck_food_special: 'Food',
  drink_special: 'Special',
  class_workshop: 'Class',
  comedy_open_mic: 'Comedy',
  festival_party: 'Party',
  sports_viewing: 'Sports',
  fundraiser_community: 'Community',
  movie_night: 'Movie',
  market_vendor: 'Market',
  other: 'Event',
};

async function loadFeed(): Promise<FeedEvent[]> {
  try {
    const file = process.env.EVENTS_FEED_FILE;
    if (file) {
      const data = JSON.parse(await readFile(file, 'utf8'));
      return Array.isArray(data) ? data : data.events || [];
    }
    const url = process.env.EVENTS_FEED_URL;
    if (!url) return [];
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (err) {
    console.error('Event feed unavailable', err);
    return [];
  }
}

function todayIn(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function whenLabel(date: string, time?: string) {
  const day = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  if (!time) return `${day} · ALL DAY`;
  const [h, m] = time.split(':').map(Number);
  const hr = h % 12 || 12;
  return `${day} ${hr}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'PM' : 'AM'}`;
}

// The homepage board: the next 7 days in one city. Featured breweries first, then one-time events, then weekly ones.
export async function getWeekBoard(cityName: string, limit = 6): Promise<{ total: number; rows: BoardRow[] }> {
  const tz = process.env.SITE_TZ || 'America/New_York';
  const start = todayIn(tz);
  const end = addDays(start, 6);
  const key = slugify(cityName);
  const events = (await loadFeed()).filter((e) => slugify(e.city || '') === key && e.date >= start && e.date <= end);

  // Spread picks across the week: up to 3 featured, no more than 2 per day, timed events before all-day specials.
  const rank = (e: FeedEvent) => (e.featured ? 0 : e.weekly ? 2 : 1) + (e.time ? 0 : 3);
  const chrono = (a: FeedEvent, b: FeedEvent) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
  const sorted = [...events].sort((a, b) => rank(a) - rank(b) || chrono(a, b));
  const picked: FeedEvent[] = [];
  const perDay = new Map<string, number>();
  let featured = 0;
  for (const pass of [true, false]) {
    for (const e of sorted) {
      if (picked.length >= limit) break;
      if (picked.includes(e)) continue;
      if (pass && ((perDay.get(e.date) || 0) >= 2 || (e.featured && featured >= 3))) continue;
      picked.push(e);
      perDay.set(e.date, (perDay.get(e.date) || 0) + 1);
      if (e.featured) featured++;
    }
  }
  picked.sort(chrono);

  return {
    total: events.length,
    rows: picked.map((e, i) => ({
      key: `${e.date}-${e.venue}-${e.title}-${i}`,
      when: whenLabel(e.date, e.time),
      title: e.title,
      venue: e.venue,
      tag: CAT[e.cat || 'other'] || 'Event',
      featured: !!e.featured,
      link: e.link,
    })),
  };
}
