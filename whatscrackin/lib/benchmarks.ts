// Brewery benchmark set: public Instagram numbers for breweries Aubrey lists by city, so each checkup report
// can say how a brewery compares with breweries near it. Pulled with the same Business Discovery lookup as reports.

import { db, ready } from './db';
import { computeMetrics, type CheckupMetrics } from './checkup-report';
import { InstagramLookupError, lookupInstagram } from './instagram';

const DAY = 24 * 60 * 60 * 1000;
// A group needs at least this many breweries with numbers before a report compares against it.
export const MIN_GROUP = 8;
// States compared as one group, never city by city (Aubrey, 2026-11-17: Orlando and Jacksonville form one Florida group).
export const STATEWIDE = new Set(['FL']);
// Numbers older than this are pulled again by "Pull numbers".
export const STALE_DAYS = 30;

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
const STATE_CODES = new Set(Object.values(STATES));
const STATE_NAMES = Object.fromEntries(Object.entries(STATES).map(([n, c]) => [c, n.replace(/\b\w/g, (x) => x.toUpperCase())]));

export function cleanState(raw: string | null | undefined): string | null {
  const s = (raw || '').trim().replace(/\./g, '');
  if (!s) return null;
  if (STATE_CODES.has(s.toUpperCase())) return s.toUpperCase();
  return STATES[s.toLowerCase()] || null;
}

export const stateName = (code: string) => STATE_NAMES[code] || code;

const titleCase = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s-])\w/g, (x) => x.toUpperCase());

// "Orlando, FL", "orlando fl", "Winter Park, Florida" -> { city, state }. State may be null.
export function splitCity(raw: string): { city: string; state: string | null } {
  const s = raw.trim().replace(/\s+/g, ' ');
  const comma = s.match(/^(.*?),\s*([^,]+)$/);
  if (comma && cleanState(comma[2])) return { city: titleCase(comma[1]), state: cleanState(comma[2]) };
  const tail = s.match(/^(.*\S)\s+([A-Za-z]{2})$/);
  if (tail && STATE_CODES.has(tail[2].toUpperCase())) return { city: titleCase(tail[1]), state: tail[2].toUpperCase() };
  return { city: titleCase(s.replace(/,\s*$/, '')), state: null };
}

// "@Foo.Brewing", "instagram.com/foo.brewing/", "https://www.instagram.com/foo_brewing?igsh=..." -> "foo.brewing"
export function cleanHandle(raw: string): string | null {
  let s = raw.trim();
  const url = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (url) s = url[1];
  s = s.replace(/^@/, '').replace(/\/+$/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) && !/^\d+$/.test(s) ? s : null;
}

export type BenchmarkInput = { handle: string; city: string; state: string | null };

// Accepts a pasted list or CSV. Each line holds a handle, optionally with a city and state
// ("@foo, Orlando, FL" / "foo<TAB>Orlando<TAB>FL" / a CSV with handle/instagram, city and state columns).
// Lines with only a handle take the default city and state.
export function parseBenchmarkInput(text: string, defaultCity: string, defaultState: string): { rows: BenchmarkInput[]; skipped: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.split(',')).map((x) => x.trim().replace(/^"|"$/g, '').trim());
  const def = splitCity(defaultCity || '');
  const defState = cleanState(defaultState) || def.state;

  let cols: { handle: number; city: number; state: number } | null = null;
  const head = lines.length ? split(lines[0]).map((x) => x.toLowerCase()) : [];
  const hIdx = head.findIndex((x) => /handle|instagram|^ig\b|username/.test(x));
  if (hIdx >= 0) {
    cols = { handle: hIdx, city: head.findIndex((x) => /city|metro|market/.test(x)), state: head.findIndex((x) => /^state|^st$/.test(x)) };
    lines.shift();
  }

  const rows: BenchmarkInput[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parts = split(line);
    let handle: string | null = null;
    let city = '';
    let state: string | null = null;
    if (cols) {
      handle = cleanHandle(parts[cols.handle] || '');
      city = cols.city >= 0 ? parts[cols.city] || '' : '';
      state = cols.state >= 0 ? cleanState(parts[cols.state]) : null;
    } else {
      // First part that looks like a handle; the rest is city / state.
      const i = parts.findIndex((p) => /^@|instagram\.com/i.test(p)) >= 0 ? parts.findIndex((p) => /^@|instagram\.com/i.test(p)) : 0;
      handle = cleanHandle(parts[i] || '');
      const rest = parts.filter((_, j) => j !== i && parts[j]);
      if (rest.length >= 2 && cleanState(rest[rest.length - 1])) {
        state = cleanState(rest[rest.length - 1]);
        city = rest.slice(0, -1).join(' ');
      } else if (rest.length) city = rest.join(', ');
    }
    if (!handle) {
      skipped.push(line);
      continue;
    }
    const sc = city ? splitCity(city) : { city: def.city, state: null };
    const finalCity = sc.city || def.city;
    const finalState = state || sc.state || (finalCity === def.city ? defState : null);
    if (!finalCity) {
      skipped.push(`${line} (no city)`);
      continue;
    }
    if (seen.has(handle)) continue;
    seen.add(handle);
    rows.push({ handle, city: finalCity, state: finalState });
  }
  return { rows, skipped };
}

export async function saveBenchmarkBreweries(rows: BenchmarkInput[]): Promise<{ added: number; updated: number }> {
  await ready();
  let added = 0;
  let updated = 0;
  for (const r of rows) {
    const [res] = await db()<{ inserted: boolean }[]>`
      insert into benchmark_breweries (handle, city, state) values (${r.handle}, ${r.city}, ${r.state})
      on conflict (handle) do update set city = excluded.city, state = coalesce(excluded.state, benchmark_breweries.state)
      returning (xmax = 0) as inserted`;
    if (res?.inserted) added++;
    else updated++;
  }
  return { added, updated };
}

const isRateLimit = (err: unknown) =>
  err instanceof InstagramLookupError && err.reason === 'api' && /limit|too many|(#|code\W*)(4|17|32|613)\b/i.test(err.message);

const benchmarkFields = (m: CheckupMetrics) => ({
  brewery: m.name,
  followers: m.followers,
  posts_analyzed: m.postsAnalyzed,
  posts_per_week: m.postsPerWeek,
  days_since_last_post: m.daysSinceLastPost,
  engagement_pct: m.engagementRatePct,
  avg_likes: m.avgLikes,
  avg_comments: m.avgComments,
  reel_share_pct: m.byType.find((t) => t.type === 'Reel or video')?.sharePct ?? 0,
  pct_with_date_or_time: m.captions.pctWithDateOrTime,
});

// Pulls numbers for breweries never pulled or pulled over STALE_DAYS ago, until the time budget runs out
// or Meta's rate limit answers. Returns what happened so the admin page can say so.
export async function pullBenchmarks({ budgetMs = 240_000, force = false } = {}): Promise<{ ok: number; failed: number; left: number; rateLimited: boolean }> {
  await ready();
  const started = Date.now();
  let ok = 0;
  let failed = 0;
  let rateLimited = false;
  const due = () => db()<{ handle: string }[]>`
    select handle from benchmark_breweries
    where ${force} or pulled_at is null or pulled_at < now() - make_interval(days => ${STALE_DAYS})
    order by pulled_at nulls first, added_at`;
  const queue = await due();
  for (const { handle } of queue) {
    if (Date.now() - started > budgetMs) break;
    try {
      const m = computeMetrics(await lookupInstagram(handle, 30));
      const f = benchmarkFields(m);
      await db()`
        update benchmark_breweries set status = 'ok', error = null, pulled_at = now(),
          brewery = ${f.brewery}, followers = ${f.followers}, posts_analyzed = ${f.posts_analyzed}, posts_per_week = ${f.posts_per_week},
          days_since_last_post = ${f.days_since_last_post}, engagement_pct = ${f.engagement_pct}, avg_likes = ${f.avg_likes},
          avg_comments = ${f.avg_comments}, reel_share_pct = ${f.reel_share_pct}, pct_with_date_or_time = ${f.pct_with_date_or_time}
        where handle = ${handle}`;
      ok++;
    } catch (err) {
      // A setup problem (missing token, no linked account) isn't the brewery's fault: stop and report it.
      if (err instanceof InstagramLookupError && err.reason === 'config') throw err;
      if (isRateLimit(err)) {
        rateLimited = true;
        await db()`update benchmark_breweries set error = ${'Meta rate limit: try again in an hour.'} where handle = ${handle}`;
        break;
      }
      const msg =
        err instanceof InstagramLookupError && err.reason === 'not_business'
          ? "Not a Business or Creator account, or the handle is wrong."
          : err instanceof Error
            ? err.message
            : String(err);
      await db()`update benchmark_breweries set status = 'failed', error = ${msg.slice(0, 300)}, pulled_at = now() where handle = ${handle}`;
      failed++;
    }
    // Stay well under Meta's per-hour call budget.
    await new Promise((r) => setTimeout(r, 400));
  }
  const left = (await due()).length;
  return { ok, failed, left: force ? Math.max(0, queue.length - ok - failed) : left, rateLimited };
}

// ---------- Comparison used in reports ----------

export type BenchmarkStat = { key: 'postsPerWeek' | 'engagementRatePct' | 'daysSinceLastPost' | 'reelSharePct'; label: string; you: number | null; typical: number; betterThanPct: number | null };
export type Benchmark = { label: string; scope: 'city' | 'state' | 'all'; breweries: number; stats: BenchmarkStat[] };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
// Share of the group this brewery beats (ties count half). higherIsBetter=false for "days since last post".
const beats = (you: number, xs: number[], higherIsBetter = true) => {
  if (!xs.length) return null;
  const better = xs.filter((x) => (higherIsBetter ? you > x : you < x)).length;
  const ties = xs.filter((x) => x === you).length;
  return Math.round(((better + ties / 2) / xs.length) * 100);
};

type Row = { handle: string; city: string; state: string | null; posts_per_week: number; engagement_pct: number; days_since_last_post: number | null; reel_share_pct: number };

// Picks the closest group with enough breweries: same city, then same state, then everyone.
export async function benchmarkFor(rawCity: string, handle: string, m: CheckupMetrics): Promise<Benchmark | null> {
  await ready();
  const rows = await db()<Row[]>`
    select handle, city, state, posts_per_week, engagement_pct, days_since_last_post, reel_share_pct
    from benchmark_breweries where status = 'ok' and posts_analyzed > 0 and handle <> ${handle.toLowerCase()}`;
  if (rows.length < MIN_GROUP) return null;

  const { city, state: typedState } = splitCity(rawCity || '');
  let state = typedState;
  if (!state && city) {
    const fromBench = rows.find((r) => r.city.toLowerCase() === city.toLowerCase() && r.state)?.state;
    const [fromCities] = fromBench ? [] : await db()<{ state: string }[]>`select state from cities where lower(name) = ${city.toLowerCase()} limit 1`;
    state = fromBench || fromCities?.state || null;
  }

  const inCity = rows.filter((r) => city && !(state && STATEWIDE.has(state)) && r.city.toLowerCase() === city.toLowerCase() && (!state || !r.state || r.state === state));
  const inState = state ? rows.filter((r) => r.state === state) : [];
  const [group, scope, label] =
    inCity.length >= MIN_GROUP
      ? [inCity, 'city' as const, `breweries in ${inCity[0].city}`]
      : inState.length >= MIN_GROUP
        ? [inState, 'state' as const, `${stateName(state!)} breweries`]
        : [rows, 'all' as const, `breweries in ${new Set(rows.map((r) => r.city)).size} cities we track`];

  const reelShare = m.byType.find((t) => t.type === 'Reel or video')?.sharePct ?? 0;
  const days = group.map((r) => r.days_since_last_post).filter((x): x is number => x !== null);
  const stats: BenchmarkStat[] = [
    { key: 'postsPerWeek', label: 'Posts a week', you: m.postsPerWeek, typical: round(median(group.map((r) => r.posts_per_week))), betterThanPct: beats(m.postsPerWeek, group.map((r) => r.posts_per_week)) },
    { key: 'engagementRatePct', label: 'Followers who like or comment on a typical post', you: m.engagementRatePct, typical: round(median(group.map((r) => r.engagement_pct)), 2), betterThanPct: beats(m.engagementRatePct, group.map((r) => r.engagement_pct)) },
    { key: 'daysSinceLastPost', label: 'Days since the last post', you: m.daysSinceLastPost, typical: Math.round(median(days)), betterThanPct: m.daysSinceLastPost === null ? null : beats(m.daysSinceLastPost, days, false) },
    { key: 'reelSharePct', label: 'Share of posts that are reels', you: reelShare, typical: Math.round(median(group.map((r) => r.reel_share_pct))), betterThanPct: null },
  ];
  return { label, scope, breweries: group.length, stats };
}

export const benchmarkAge = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / DAY) : null);
