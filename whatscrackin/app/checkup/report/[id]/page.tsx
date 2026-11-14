import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import type { CheckupContent, CheckupMetrics } from '@/lib/checkup-report';
import { db, ready } from '@/lib/db';
import { isPreview } from '@/lib/preview';
import { SaveReportButton } from '@/components/print-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your Instagram checkup · Crackem', robots: { index: false } };

type Row = { id: string; status: string; metrics: CheckupMetrics | null; content: CheckupContent | null; error: string | null; brewery: string; updated_at: Date };

const fmt = (n: number) => n.toLocaleString('en-US');

export default async function CheckupReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{20}$/.test(id)) notFound();
  await ready();
  const [r] = await db()<Row[]>`
    select rep.id, rep.status, rep.metrics, rep.content, rep.error, req.brewery, rep.updated_at
    from checkup_reports rep join checkup_requests req on req.id = rep.request_id where rep.id = ${id}`;
  if (!r) notFound();
  // Preview deployments (behind Vercel's login) show drafts so reports can be checked before launch.
  const h = await headers();
  const canSeeDraft = isPreview(h.get('x-forwarded-host') || h.get('host')) || Boolean(await getAdmin());
  // Anyone with the link can watch the report build; it reloads itself until it's done.
  if (r.status === 'building') {
    return (
      <main className="wrap checkup-report">
        <meta httpEquiv="refresh" content="8" />
        <h1>Building your report…</h1>
        <p className="muted">We&apos;re reading {r.brewery}&apos;s recent posts and writing it up. This takes about a minute and the page refreshes on its own.</p>
      </main>
    );
  }
  if (r.status === 'failed' && !canSeeDraft) {
    return (
      <main className="wrap checkup-report">
        <h1>We couldn&apos;t read this Instagram account.</h1>
        <p className="muted">
          Usually that means the handle has a typo or the account isn&apos;t set up as a Business or Creator account. We&apos;ve been
          notified and will follow up by email.
        </p>
      </main>
    );
  }
  if (r.status === 'draft' && !canSeeDraft) {
    return (
      <main className="wrap checkup-report">
        <h1>Your report is on its way.</h1>
        <p className="muted">We&apos;re putting the finishing touches on it. You&apos;ll get an email when it&apos;s ready.</p>
      </main>
    );
  }
  if (!r.metrics || !r.content) {
    return (
      <main className="wrap checkup-report">
        <p className="report-banner">Draft for admins: this report failed. {r.error}</p>
      </main>
    );
  }

  const m = r.metrics;
  const c = r.content;
  const adPost = m.topPosts[c.mock_ad.post_index] || m.topPosts[0];

  return (
    <main className="wrap checkup-report">
      {r.status !== 'sent' && (
        <p className="report-banner no-print">Draft: breweries can't see this until you send it from the admin page.</p>
      )}
      <header className="report-head">
        <span className="eyebrow">Crackem Instagram checkup · @{m.username}</span>
        <h1>{c.headline}</h1>
        <p className="report-owner">{c.owner_summary}</p>
        <SaveReportButton fileName={`Crackem Instagram checkup - ${r.brewery}`} />
      </header>

      <section className="report-stats" aria-label="Your numbers">
        <div><b>{fmt(m.followers)}</b><span>followers</span></div>
        <div><b>{m.postsPerWeek}</b><span>posts a week (last 30 days)</span></div>
        <div><b>{fmt(m.avgLikes)}</b><span>average likes a post</span></div>
        <div><b>{m.engagementRatePct}%</b><span>of followers like or comment on a typical post</span></div>
      </section>
      <p className="muted report-note">Based on your last {m.postsAnalyzed} posts. Only public numbers: we can&apos;t see reach or saves.</p>

      <section className="report-grid">
        <div>
          <h2>What&apos;s working</h2>
          <ul className="report-list good">
            {c.working.map((w, i) => <li key={i}><b>{w.title}</b> {w.detail}</li>)}
          </ul>
        </div>
        <div>
          <h2>What&apos;s holding you back</h2>
          <ul className="report-list fix">
            {c.fixes.map((w, i) => <li key={i}><b>{w.title}</b> {w.detail}</li>)}
          </ul>
        </div>
      </section>

      <section>
        <h2>Three things to do this month</h2>
        <ol className="report-tasks">
          {c.tasks.slice(0, 3).map((t, i) => (
            <li key={i}><div><b>{t.title}</b><span className="mins">About {t.minutes} min</span></div><p>{t.how}</p></li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Captions you can use</h2>
        <div className="report-captions">
          {c.captions.map((cap, i) => (
            <figure key={i}><figcaption>{cap.for_what}</figcaption><blockquote>{cap.caption}</blockquote></figure>
          ))}
        </div>
      </section>

      <section>
        <h2>What an event ad could look like</h2>
        <div className="report-ad">
          <div className="ad-card">
            <div className="ad-top"><b>{m.name}</b><small>Sponsored</small></div>
            <p>{c.mock_ad.primary_text}</p>
            {adPost?.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={adPost.mediaUrl} alt="Your post used in the ad" />
            ) : (
              <a className="ad-media" href={adPost?.permalink} target="_blank" rel="noreferrer">Built from your post from {adPost?.date}. View it on Instagram</a>
            )}
            <div className="ad-foot"><span>{c.mock_ad.headline}</span><span className="btn btn-dark sm">{c.mock_ad.call_to_action}</span></div>
          </div>
          <div>
            <p>We&apos;d build this from your post from {adPost?.date}, one of your best performers, and show it to {c.mock_ad.audience}.</p>
            <p className="muted">Want us to run ads like this for your next event? Reply to the email this report came in, and we&apos;ll handle it start to finish.</p>
          </div>
        </div>
      </section>

      <p className="muted report-note">Crackem · Report updated {r.updated_at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </main>
  );
}
