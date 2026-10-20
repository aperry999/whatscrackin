import { getAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

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
