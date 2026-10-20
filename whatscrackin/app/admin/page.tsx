import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/chrome';
import { getAdmin } from '@/lib/auth';
import { getCitiesWithCounts, goalFor } from '@/lib/cities';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { addCity, deleteCity, inviteAdmin, removeAdmin, signOut, updateCity, updateSettings } from './actions';

export const metadata: Metadata = { title: "Admin · What's Crackin'", robots: { index: false } };
export const dynamic = 'force-dynamic';

const SOURCE = { custom: 'Custom', suggested: 'From brewery count', default: 'Default' } as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  const { msg } = await searchParams;
  const isOwner = admin.role === 'owner';

  const [settings, cities, team, waitlist] = await Promise.all([
    getSettings(),
    getCitiesWithCounts(),
    db()<{ email: string; role: string; invited_by: string | null }[]>`select email, role, invited_by from admins order by role desc, created_at`,
    db()<{ n: number }[]>`select count(*)::int as n from trip_waitlist`,
  ]);

  const rows = cities.map((c) => {
    const g = goalFor(c, settings);
    const pct = Math.min(100, Math.floor((c.requests / g.goal) * 100));
    const visibility = c.status === 'live' ? 'Live' : c.requests * 100 >= g.goal * settings.revealPct ? 'Public' : 'Hidden';
    return { c, g, pct, visibility };
  });
  const totalRequests = cities.reduce((n, c) => n + c.requests, 0);
  const publicCount = rows.filter((r) => r.visibility === 'Public').length;

  return (
    <div className="admin">
      <header className="admin-top">
        <Wordmark />
        <div className="admin-me">
          <span>{admin.email} · {isOwner ? 'Owner' : 'Editor'}</span>
          <form action={signOut}><button className="btn btn-ghost sm" type="submit">Sign out</button></form>
        </div>
      </header>

      <main className="admin-main">
        {msg && <p className="notice" role="status">{msg}</p>}

        <div className="stats">
          <div><b>{cities.filter((c) => c.status === 'live').length}</b><span>Live cities</span></div>
          <div><b>{totalRequests}</b><span>City requests</span></div>
          <div><b>{publicCount}</b><span>Cities shown publicly</span></div>
          <div><b>{waitlist[0].n}</b><span>Trip waitlist</span></div>
        </div>

        <section className="admin-section">
          <div className="admin-head">
            <div>
              <h1>Cities</h1>
              <p className="muted">Live cities appear in the homepage dropdown. Waiting cities go public at {settings.revealPct}% of their goal.</p>
            </div>
            <div className="admin-tools">
              <form action={addCity} className="inline-form">
                <input className="input sm" name="city" placeholder="Add a city, e.g. Tampa, FL" aria-label="City to add" required />
                <button className="btn btn-dark sm" type="submit">Add</button>
              </form>
              <a className="btn btn-ghost sm" href="/admin/export">Export all requests</a>
            </div>
          </div>

          <div className="ctable">
            <div className="crow chead">
              <span>City</span>
              <span>Requests</span>
              <span>Breweries</span>
              <span>Goal</span>
              <span>Progress</span>
              <span>Status</span>
              <span><span className="sr">Save</span></span>
            </div>
            {rows.map(({ c, g, pct, visibility }) => (
              <form key={c.id} action={updateCity} className="crow">
                <input type="hidden" name="id" value={c.id} />
                <span className="cname">
                  <b>{c.name}, {c.state}</b>
                  <span className={`pill ${visibility.toLowerCase()}`}>{visibility}</span>
                </span>
                <span className="mono">{c.requests}</span>
                <span><input className="input sm num" name="brewery_count" defaultValue={c.brewery_count ?? ''} inputMode="numeric" aria-label={`Breweries in ${c.name}`} /></span>
                <span className="goal">
                  <input className="input sm num" name="goal" defaultValue={c.goal ?? ''} placeholder={String(g.goal)} inputMode="numeric" aria-label={`Launch goal for ${c.name}`} />
                  <small>{SOURCE[g.source]}{g.source !== 'custom' ? `: ${g.goal}` : ''}</small>
                </span>
                <span className="prog">
                  {c.status === 'live' ? <span className="muted">Launched</span> : (
                    <><span className="bar"><i style={{ width: `${pct}%`, background: visibility === 'Public' ? 'var(--accent)' : '#9aa0a8' }} /></span><span className="mono">{pct}%</span></>
                  )}
                </span>
                <span>
                  <select className="select sm" name="status" defaultValue={c.status} aria-label={`Status of ${c.name}`}>
                    <option value="waiting">Waiting</option>
                    <option value="live">Live</option>
                  </select>
                </span>
                <span><button className="btn btn-dark sm" type="submit">Save</button></span>
                <details className="cmore">
                  <summary>More</summary>
                  <div className="cmore-body">
                    <label className="label">beehiiv tag<input className="input sm" name="beehiiv_tag" defaultValue={c.beehiiv_tag ?? ''} placeholder={c.name} /></label>
                    <label className="label">Latitude<input className="input sm" name="lat" defaultValue={c.lat ?? ''} inputMode="decimal" /></label>
                    <label className="label">Longitude<input className="input sm" name="lng" defaultValue={c.lng ?? ''} inputMode="decimal" /></label>
                    <p className="muted small">Latitude and longitude let the homepage preselect this city for visitors nearby. The tag is added to new subscribers in beehiiv.</p>
                    <div className="cmore-actions">
                      {c.requests > 0 && <a href={`/admin/export?city=${c.slug}`}>Export {c.requests} request{c.requests === 1 ? '' : 's'}</a>}
                      <label className="check"><input type="checkbox" name="confirmDelete" value="yes" /> Delete {c.name}{c.requests ? ` and its ${c.requests} requests` : ''}</label>
                      <button className="btn btn-ghost sm danger" type="submit" formAction={deleteCity}>Delete</button>
                    </div>
                  </div>
                </details>
              </form>
            ))}
          </div>
        </section>

        <div className="admin-grid">
          <section className="admin-card">
            <h2>Launch settings</h2>
            {isOwner ? (
              <form action={updateSettings} className="stack">
                <label className="label">Default launch goal<input className="input sm num" name="default_goal" defaultValue={settings.defaultGoal} inputMode="numeric" /></label>
                <label className="label">Show publicly at (% of goal)<input className="input sm num" name="reveal_pct" defaultValue={settings.revealPct} inputMode="numeric" /></label>
                <label className="check"><input type="checkbox" name="suggest" defaultChecked={settings.suggestFromBreweries} /> Suggest goals from brewery count</label>
                <p className="muted small">With a brewery count entered, a city with 8 breweries suggests about 40 requests and one with 80 suggests about 250. A custom goal always wins.</p>
                <button className="btn btn-dark sm" type="submit">Save settings</button>
              </form>
            ) : (
              <p className="muted">Default goal {settings.defaultGoal}, public at {settings.revealPct}%. Only owners can change these.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>Trip waitlist</h2>
            <p className="muted">{waitlist[0].n} {waitlist[0].n === 1 ? 'person wants' : 'people want'} to know when trip lists launch.</p>
            {waitlist[0].n > 0 && <a className="btn btn-ghost sm" href="/admin/export?type=waitlist" style={{ alignSelf: 'flex-start' }}>Export waitlist</a>}
          </section>

          {isOwner && (
            <section className="admin-card">
              <h2>Team</h2>
              <ul className="team">
                {team.map((t) => (
                  <li key={t.email}>
                    <span><b>{t.email}</b><small>{t.role === 'owner' ? 'Owner' : 'Editor'}</small></span>
                    {t.email !== admin.email && (
                      <form action={removeAdmin}><input type="hidden" name="email" value={t.email} /><button className="linkish" type="submit">Remove</button></form>
                    )}
                  </li>
                ))}
              </ul>
              <form action={inviteAdmin} className="stack">
                <label className="label">Invite by email<input className="input sm" type="email" name="email" required /></label>
                <label className="label">Role
                  <select className="select sm" name="role" defaultValue="editor">
                    <option value="editor">Editor: cities and requests</option>
                    <option value="owner">Owner: everything</option>
                  </select>
                </label>
                <button className="btn btn-dark sm" type="submit">Send invite</button>
              </form>
            </section>
          )}
        </div>

        <p className="muted small"><Link href="/">View the site</Link></p>
      </main>
    </div>
  );
}
