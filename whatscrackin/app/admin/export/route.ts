import { getAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkupOrigin, currentOrigin } from '@/lib/site';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? '');
  // Quote everything and neutralize spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response('Sign in first.', { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  let rows: Record<string, unknown>[];
  let name: string;

  if (type === 'checkups') {
    const origin = await currentOrigin();
    const rows = await db()`
      select req.brewery, req.city, req.ig_handle, req.name, req.email, req.who_posts, req.created_at, req.campaign, req.source, req.reused_report,
        rep.id as report_id, rep.status, rep.sent_at, rep.ran_ads, rep.error,
        rep.metrics->>'followers' as followers, rep.metrics->>'postsPerWeek' as posts_per_week,
        rep.metrics->>'engagementRatePct' as engagement_pct, rep.metrics->>'daysSinceLastPost' as days_since_last_post
      from checkup_requests req left join checkup_reports rep on rep.request_id = req.id
      order by req.created_at`;
    const header = ['brewery', 'city', 'instagram', 'name', 'email', 'who_posts', 'requested_at', 'report_status', 'report_sent_at', 'report_link',
      'followers', 'posts_per_week', 'engagement_pct', 'days_since_last_post', 'ran_ads_before', 'problem', 'came_from', 'request_type'];
    const body = rows.map((r) =>
      [r.brewery, r.city, r.ig_handle, r.name, r.email, r.who_posts, r.created_at, r.status, r.sent_at,
        r.report_id ? `${checkupOrigin(origin)}/checkup/report/${r.report_id}` : '',
        r.followers, r.posts_per_week, r.engagement_pct, r.days_since_last_post, r.ran_ads, r.error, r.campaign, r.reused_report ? 'repeat' : r.source].map(cell).join(','),
    );
    return new Response([header.join(','), ...body].join('\n') + '\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="checkup-requests.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (type === 'benchmarks') {
    const rows = await db()`
      select handle, brewery, city, state, status, followers, posts_analyzed, posts_per_week, engagement_pct, days_since_last_post,
        avg_likes, avg_comments, reel_share_pct, pct_with_date_or_time, pulled_at, error
      from benchmark_breweries order by state nulls last, city, handle`;
    const header = ['instagram', 'brewery', 'city', 'state', 'status', 'followers', 'posts_analyzed', 'posts_per_week', 'engagement_pct',
      'days_since_last_post', 'avg_likes', 'avg_comments', 'reel_share_pct', 'pct_captions_with_date_or_time', 'pulled_at', 'problem'];
    const body = rows.map((r) =>
      [r.handle, r.brewery, r.city, r.state, r.status, r.followers, r.posts_analyzed, r.posts_per_week, r.engagement_pct, r.days_since_last_post,
        r.avg_likes, r.avg_comments, r.reel_share_pct, r.pct_with_date_or_time, r.pulled_at, r.error].map(cell).join(','),
    );
    return new Response([header.join(','), ...body].join('\n') + '\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="brewery-benchmarks.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (type === 'waitlist') {
    rows = await db()`select email, city, created_at from trip_waitlist order by created_at`;
    name = 'trip-waitlist';
  } else {
    const slug = url.searchParams.get('city');
    rows = slug
      ? await db()`select r.email, c.name || ', ' || c.state as city, r.created_at
          from city_requests r join cities c on c.id = r.city_id where c.slug = ${slug} order by r.created_at`
      : await db()`select r.email, c.name || ', ' || c.state as city, r.created_at
          from city_requests r join cities c on c.id = r.city_id order by c.name, r.created_at`;
    name = slug ? `requests-${slug}` : 'city-requests';
  }

  const header = ['email', 'city', 'requested_at'];
  const body = rows.map((r) => [r.email, r.city, r.created_at].map(cell).join(','));
  return new Response([header.join(','), ...body].join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
