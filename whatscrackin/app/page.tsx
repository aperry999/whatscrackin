import Link from 'next/link';
import { headers } from 'next/headers';
import { SiteFooter, SiteHeader } from '@/components/chrome';
import { CityRequestForm, HeroForm } from '@/components/forms';
import { getLiveCities, getPublicDeck, nearestLiveCity } from '@/lib/cities';
import { getWeekBoard } from '@/lib/events';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

function num(v: string | null) {
  const n = v == null ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default async function Home() {
  const h = await headers();
  const [settings, live] = await Promise.all([getSettings(), getLiveCities()]);
  const deck = await getPublicDeck(settings);

  // Preselect the nearest live city. Visitors we can locate who aren't near one land on "My city isn't listed".
  const lat = num(h.get('x-vercel-ip-latitude'));
  const lng = num(h.get('x-vercel-ip-longitude'));
  const near = nearestLiveCity(live, lat, lng);
  const located = lat != null && lng != null;
  const initial = near?.slug ?? (located || !live.length ? 'other' : live[0].slug);
  const boardCity = near ?? live[0] ?? null;
  const board = boardCity ? await getWeekBoard(boardCity.name) : { total: 0, rows: [] };
  const liveLabel = live.length === 1 ? `${live[0].name} edition · live` : `${live.length} cities · live`;

  return (
    <>
      <SiteHeader />
      <main>
        <section id="subscribe" className="wrap hero">
          <div className="hero-copy">
            {live.length > 0 && (
              <div className="eyebrow live-dot"><i aria-hidden="true" /> <span>{liveLabel}</span></div>
            )}
            <h1>Every local craft beer event. Delivered weekly.</h1>
            <p className="lede">
              Trivia, tap takeovers, run clubs and release parties at every brewery and beer bar in town. We read their posts so
              you don&apos;t have to.
            </p>
            <HeroForm cities={live.map((c) => ({ slug: c.slug, label: `${c.name}, ${c.state}` }))} initial={initial} />
          </div>

          <div id="week" className="board">
            <div className="board-head">
              <span>This week{boardCity ? ` · ${boardCity.name}` : ''}</span>
              {board.total > 0 && <b>{board.total} events</b>}
            </div>
            {board.rows.length ? (
              <div>
                {board.rows.map((r) => (
                  <div key={r.key} className={r.featured ? 'ev featured' : 'ev'}>
                    <span className="when">{r.when}</span>
                    <div className="what">
                      <b>{r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer">{r.title}</a> : r.title}</b>
                      <span>{r.venue}{r.featured ? ' · ★ Featured' : ''}</span>
                    </div>
                    <span className="tag">{r.tag}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="board-empty">This week&apos;s lineup is being poured. Subscribe and it lands in your inbox Thursday morning.</p>
            )}
            <div className="board-foot">The full list lands in your inbox every week.</div>
          </div>
        </section>

        <section className="section-band">
          <div className="wrap section">
            <div className="section-head">
              <span className="eyebrow">Why subscribe</span>
              <h2>Your weekend, sorted by Thursday</h2>
            </div>
            <div className="cards">
              <div className="card">
                <span className="num">01</span>
                <h3>Every brewery event in one place</h3>
                <p>
                  Live music, trivia, releases, food trucks and festivals from every brewery in town, gathered into one weekly email.
                  Skip the dozen Instagram feeds.
                </p>
              </div>
              <div className="card">
                <span className="num">02</span>
                <h3>Plan your weekend in two minutes</h3>
                <p>It lands Thursday morning, organized by day with our top picks up front, so you know where to go before the weekend starts.</p>
              </div>
              <div className="card">
                <span className="num">03</span>
                <h3>Never miss the good stuff</h3>
                <p>Limited releases, anniversary parties and one-night-only events get flagged, so you hear about them before they sell out.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="cities" className="wrap deck">
          <div className="deck-copy">
            <span className="eyebrow">Cities on deck</span>
            <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 38px)', lineHeight: 1.12, letterSpacing: '-0.015em' }}>Your city could be next.</h2>
            <p>Every city launches when it reaches its request goal. Cities show up here once they&apos;re close, so share it with friends who&apos;d want it.</p>
            <CityRequestForm />
          </div>
          <div className="deck-list" aria-label="Cities close to launching">
            {deck.length ? (
              deck.map((c) => (
                <div key={c.slug} className="deck-city">
                  <div className="top">
                    <span className="name">{c.label}</span>
                    <span className="count">{c.requests} / {c.goal}</span>
                  </div>
                  <div className="bar" role="progressbar" aria-label={`${c.label} requests`} aria-valuemin={0} aria-valuemax={c.goal} aria-valuenow={c.requests}>
                    <i style={{ width: `${c.pct}%` }} />
                  </div>
                  <span className="left">{c.requests >= c.goal ? 'Goal reached · launching soon' : `${c.goal - c.requests} to go`}</span>
                </div>
              ))
            ) : (
              <p className="deck-empty">No cities are close to launching yet. Request yours and get your friends to do the same.</p>
            )}
          </div>
        </section>

        <section className="trips-band">
          <div className="wrap section">
            <div className="trips-top">
              <div className="section-head">
                <span className="eyebrow">Custom trip event lists · coming soon</span>
                <h2>New city? Know what&apos;s pouring before you land.</h2>
                <p>Your own interactive link to every brewery event in the city you&apos;re visiting, on the exact dates you&apos;re there.</p>
              </div>
              <Link className="btn btn-accent" href="/trips">Get early access</Link>
            </div>
            <div className="points">
              <div className="point">
                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="#E8A33D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="20" height="18" rx="2" /><line x1="4" y1="11" x2="24" y2="11" /><line x1="9" y1="3" x2="9" y2="8" /><line x1="19" y1="3" x2="19" y2="8" /></svg>
                <h3>See it by day or by brewery</h3>
                <p>Plan each day around what&apos;s on, or check what one taproom has going while you&apos;re in town.</p>
              </div>
              <div className="point">
                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="#E8A33D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="4,6 24,6 16,15 16,23 12,21 12,15" /></svg>
                <h3>Filter for your thing</h3>
                <p>Only want live music? Trivia? A run club before brunch? One tap clears out the rest.</p>
              </div>
              <div className="point">
                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="#E8A33D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 25s-8-7.2-8-13a8 8 0 0 1 16 0c0 5.8-8 13-8 13z" /><circle cx="14" cy="12" r="3" /></svg>
                <h3>Your city, your dates</h3>
                <p>Pick any city in the country. You only see events happening while you&apos;re actually there.</p>
              </div>
              <div className="point">
                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="#E8A33D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M16 12a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1.5-1.5" /></svg>
                <h3>One link that keeps up</h3>
                <p>Save it to your phone. It fills in as breweries post, right up to your last night.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
