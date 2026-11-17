import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/chrome';
import { PendingButton } from '@/components/pending-button';
import { getAdmin } from '@/lib/auth';
import { MIN_GROUP, STALE_DAYS, STATEWIDE, stateName } from '@/lib/benchmarks';
import { db, ready } from '@/lib/db';
import { addBenchmarkBreweries, pullBenchmarkNumbers, removeBenchmarkBrewery } from './actions';

export const metadata: Metadata = { title: "Benchmarks · What's Crackin' admin", robots: { index: false } };
export const dynamic = 'force-dynamic';
// "Pull numbers" keeps running in the background after the page answers.
export const maxDuration = 300;

type Row = {
  handle: string;
  city: string;
  state: string | null;
  status: 'pending' | 'ok' | 'failed';
  error: string | null;
  brewery: string | null;
  followers: number | null;
  posts_per_week: number | null;
  engagement_pct: number | null;
  days_since_last_post: number | null;
  reel_share_pct: number | null;
  pulled_at: Date | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '–' : String(Math.round(n * 10 ** d) / 10 ** d));

function summarize(label: string, rows: Row[]) {
  const ok = rows.filter((r) => r.status === 'ok');
  return {
    label,
    total: rows.length,
    ok: ok.length,
    failed: rows.filter((r) => r.status === 'failed').length,
    waiting: rows.filter((r) => r.status === 'pending').length,
    ppw: median(ok.map((r) => r.posts_per_week ?? 0)),
    eng: median(ok.map((r) => r.engagement_pct ?? 0)),
    days: median(ok.map((r) => r.days_since_last_post).filter((x): x is number => x !== null)),
    reels: median(ok.map((r) => r.reel_share_pct ?? 0)),
    followers: median(ok.map((r) => r.followers ?? 0)),
  };
}

export default async function BenchmarksPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  if (!(await getAdmin())) redirect('/admin/login');
  const { msg } = await searchParams;
  await ready();
  const [rows, pull] = await Promise.all([
    db()<Row[]>`select handle, city, state, status, error, brewery, followers, posts_per_week, engagement_pct, days_since_last_post, reel_share_pct, pulled_at
      from benchmark_breweries order by state nulls last, city, handle`,
    db()<{ value: string }[]>`select value from settings where key = 'benchmark_pull'`,
  ]);
  const pullState = pull[0]?.value || '';
  const running = pullState.startsWith('running:') && Date.now() - Number(pullState.slice(8)) < 6 * 60_000;
  const lastResult = pullState.startsWith('done:') ? pullState.slice(5 + 25) : null;
  const lastAt = pullState.startsWith('done:') ? new Date(pullState.slice(5, 29)) : null;

  const cities = [...new Map(rows.map((r) => [`${r.city}|${r.state ?? ''}`, r])).values()].map((r) =>
    summarize(`${r.city}${r.state ? `, ${r.state}` : ''}`, rows.filter((x) => x.city === r.city && (x.state ?? '') === (r.state ?? ''))),
  );
  const states = [...new Set(rows.map((r) => r.state).filter((s): s is string => Boolean(s)))].map((s) =>
    summarize(`All of ${stateName(s)}`, rows.filter((r) => r.state === s)),
  );
  // A state row only adds something when the state has more than one city.
  const multiCityStates = states.filter((s) => new Set(rows.filter((r) => `All of ${stateName(r.state ?? '')}` === s.label).map((r) => r.city)).size > 1);
  const groups = [...cities, ...multiCityStates, summarize('Everyone', rows)];
  const failed = rows.filter((r) => r.status === 'failed');

  return (
    <div className="admin">
      <header className="admin-top">
        <Wordmark />
        <div className="admin-me"><Link href="/admin">Back to admin</Link></div>
      </header>

      <main className="admin-main">
        {msg && <p className="notice" role="status">{msg}</p>}

        <section className="admin-section">
          <div>
            <h1>Brewery benchmarks</h1>
            <p className="muted">
              Public Instagram numbers for breweries you list, so each checkup report can say how a brewery compares with others.
              A report compares with its own city once {MIN_GROUP} breweries there have numbers, then its state, then everyone. {[...STATEWIDE].map(stateName).join(', ')} breweries are always compared as one state group.
            </p>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <h2>Add breweries</h2>
              <form action={addBenchmarkBreweries} className="stack">
                <label className="label">
                  Instagram handles, one per line
                  <textarea className="input" name="handles" rows={8} style={{ height: 'auto', minHeight: 180, paddingBlock: 10, fontFamily: 'var(--mono)', fontSize: 14 }} placeholder={'@foobrewing\nbarbeerco, Orlando, FL\nhttps://instagram.com/bazales'} />
                </label>
                <label className="label">Or a CSV file (columns: handle, city, state)<input className="input sm" type="file" name="file" accept=".csv,.tsv,.txt,text/csv,text/plain" /></label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label className="label" style={{ flex: '1 1 160px' }}>City for lines without one<input className="input sm" name="city" placeholder="Orlando" /></label>
                  <label className="label" style={{ flex: '0 1 90px' }}>State<input className="input sm" name="state" placeholder="FL" maxLength={20} /></label>
                </div>
                <PendingButton className="btn btn-dark sm" label="Add to the list" pendingLabel="Adding…" />
              </form>
            </section>

            <section className="admin-card">
              <h2>Pull numbers</h2>
              <p className="muted">
                Fetches breweries that have never been pulled or were pulled more than {STALE_DAYS} days ago. It runs in the background for up to
                about 4 minutes (roughly 100 breweries); press it again for the rest. Meta limits how many lookups we can make each hour.
              </p>
              {running ? (
                <p className="notice">A pull is running now. Refresh in a few minutes.</p>
              ) : (
                lastResult && <p className="muted small">{lastAt && !isNaN(lastAt.getTime()) ? `${lastAt.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}: ` : ''}{lastResult}</p>
              )}
              <form action={pullBenchmarkNumbers} className="stack">
                <label className="check"><input type="checkbox" name="force" value="yes" /> Pull everyone again, even if recent</label>
                <PendingButton className="btn btn-dark sm" label="Pull numbers" pendingLabel="Starting…" />
              </form>
              {rows.length > 0 && <a className="btn btn-ghost sm" href="/admin/export?type=benchmarks" style={{ alignSelf: 'flex-start' }}>Download CSV</a>}
            </section>
          </div>
        </section>

        {rows.length > 0 && (
          <section className="admin-section">
            <h2>Typical numbers (median)</h2>
            <div className="bench-wrap">
              <table className="bench-table">
                <thead>
                  <tr><th>Group</th><th className="num">With numbers</th><th className="num">Followers</th><th className="num">Posts a week</th><th className="num">Engagement</th><th className="num">Days since post</th><th className="num">Reels</th></tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.label}>
                      <td><b>{g.label}</b></td>
                      <td className="num">{g.ok} of {g.total}{g.waiting ? ` · ${g.waiting} waiting` : ''}{g.failed ? ` · ${g.failed} failed` : ''}</td>
                      <td className="num">{fmt(g.followers, 0)}</td>
                      <td className="num">{fmt(g.ppw)}</td>
                      <td className="num">{g.eng === null ? '–' : `${fmt(g.eng, 2)}%`}</td>
                      <td className="num">{fmt(g.days, 0)}</td>
                      <td className="num">{g.reels === null ? '–' : `${fmt(g.reels, 0)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {failed.length > 0 && (
          <section className="admin-section">
            <h2>Couldn&apos;t pull ({failed.length})</h2>
            <p className="muted">Usually a personal account (Meta only shares Business and Creator accounts) or a typo. Fix the handle by adding it again, or remove it.</p>
            <ul className="team">
              {failed.map((r) => (
                <li key={r.handle}>
                  <span><b>@{r.handle} · {r.city}</b><small>{r.error}</small></span>
                  <form action={removeBenchmarkBrewery}><input type="hidden" name="handle" value={r.handle} /><button className="linkish" type="submit">Remove</button></form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rows.length > 0 && (
          <details className="admin-section">
            <summary><b>All {rows.length} breweries</b></summary>
            <div className="bench-wrap">
              <table className="bench-table">
                <thead>
                  <tr><th>Brewery</th><th>City</th><th className="num">Followers</th><th className="num">Posts a week</th><th className="num">Engagement</th><th className="num">Days since post</th><th className="num">Reels</th><th><span className="sr">Remove</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.handle}>
                      <td><a href={`https://www.instagram.com/${r.handle}/`} target="_blank" rel="noreferrer">@{r.handle}</a>{r.brewery && <><br /><small className="muted">{r.brewery}</small></>}</td>
                      <td>{r.city}{r.state ? `, ${r.state}` : ''}</td>
                      {r.status === 'ok' ? (
                        <>
                          <td className="num">{fmt(r.followers, 0)}</td>
                          <td className="num">{fmt(r.posts_per_week)}</td>
                          <td className="num">{fmt(r.engagement_pct, 2)}%</td>
                          <td className="num">{fmt(r.days_since_last_post, 0)}</td>
                          <td className="num">{fmt(r.reel_share_pct, 0)}%</td>
                        </>
                      ) : (
                        <td colSpan={5} className="muted">{r.status === 'failed' ? 'Couldn’t pull' : 'Waiting to pull'}</td>
                      )}
                      <td><form action={removeBenchmarkBrewery}><input type="hidden" name="handle" value={r.handle} /><button className="linkish" type="submit">Remove</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
