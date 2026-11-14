import { after, NextResponse } from 'next/server';
import { readForm, reply, tooMany } from '@/lib/api';
import { buildCheckupReport, newReportId } from '@/lib/checkup-report';
import { alertOwners } from '@/lib/alerts';
import { db, ready } from '@/lib/db';
import { cleanEmail } from '@/lib/email';

// The report is built after the response is sent; give that work room to finish.
export const maxDuration = 300;

const ROLES = ['Owner', 'Taproom manager', 'Bartender or staff', 'Marketing person or agency', 'Nobody really'];
const clean = (v: string | undefined, max: number) => (v || '').replace(/[<>{}\\]/g, '').trim().slice(0, max);

// Accepts "@brewery", "brewery" or an instagram.com profile link and returns the bare handle.
function cleanHandle(raw: string | undefined): string | null {
  const h = (raw || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '')
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

export async function POST(req: Request) {
  if (tooMany(req)) return reply('Too many tries. Wait a few minutes and try again.', 429);
  const form = await readForm(req);
  // The checkup form has no hidden spam-trap field (browser autofill kept tripping it);
  // the rate limit and manual review before sending cover abuse.
  if (!form || form === 'bot') return reply('Something went wrong. Try again.', 400);

  const brewery = clean(form.brewery, 120);
  const city = clean(form.city, 80);
  const handle = cleanHandle(form.handle);
  const name = clean(form.name, 80);
  const email = cleanEmail(form.email);
  const role = ROLES.includes(form.role || '') ? form.role! : null;

  if (!brewery) return reply('Add your brewery name.', 400);
  if (!city) return reply('Add your city.', 400);
  if (!handle) return reply('Add your Instagram handle, like yourbrewery.', 400);
  if (!name) return reply('Add your name.', 400);
  if (!email) return reply('Enter a valid email address.', 400);
  if (form.consent !== 'yes') return reply('Tick the box so we can email you the report.', 400);

  await ready();
  const [row] = await db()<{ id: number }[]>`insert into checkup_requests (brewery, city, ig_handle, name, email, who_posts)
    values (${brewery}, ${city}, ${handle}, ${name}, ${email}, ${role}) returning id`;
  alertOwners('Instagram checkup request', {
    Brewery: brewery,
    City: city,
    Instagram: `@${handle} (https://instagram.com/${handle})`,
    Name: name,
    Email: email,
    'Who posts': role,
    Form: 'Crackem Instagram checkup (/checkup)',
  });
  const reportId = newReportId();
  await db()`insert into checkup_reports (id, request_id, status) values (${reportId}, ${row.id}, 'building')`;
  after(async () => {
    try {
      await buildCheckupReport(row.id, { autoSend: true });
    } catch (err) {
      console.error('checkup report build failed', err);
    }
  });
  const thanks = `Thanks! We'll email the report for @${handle} to ${email} in a few minutes.`;
  // The thank-you screen links straight to the report, which fills in about a minute later.
  return NextResponse.json({ message: thanks, reportLink: `/checkup/report/${reportId}` });
}
