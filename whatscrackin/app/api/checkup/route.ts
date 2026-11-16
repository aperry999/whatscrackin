import { after, NextResponse } from 'next/server';
import { readForm, reply, tooMany } from '@/lib/api';
import { emailCheckupReport, formatDay, latestReportFor, nextFreeDate } from '@/lib/checkup-report';
import { alertCheckup, startCheckup, type CheckupLead } from '@/lib/checkup-start';
import { db, ready } from '@/lib/db';
import { currentOrigin } from '@/lib/site';
import { cleanEmail } from '@/lib/email';
import { cleanCampaign } from '@/lib/campaign';

// The report is built after the response is sent; give that work room to finish.
export const maxDuration = 300;

const MAX_HANDLES_PER_EMAIL = 5;
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
  const campaign = cleanCampaign(form.src);
  const lead: CheckupLead = { brewery, city, handle, name, email, role, campaign };
  const origin = await currentOrigin(); // read now: request headers aren't available inside after()

  // One person can't run free reports on lots of different breweries.
  const [{ n: otherHandles }] = await db()<{ n: number }[]>`
    select count(distinct ig_handle)::int as n from checkup_requests
    where email = ${email} and ig_handle <> ${handle} and created_at > now() - interval '30 days' and reused_report is null`;
  if (otherHandles >= MAX_HANDLES_PER_EMAIL) {
    return reply(`You've already requested reports for ${MAX_HANDLES_PER_EMAIL} breweries this month. Reply to one of your report emails and we'll help.`, 429);
  }

  // One free report per Instagram account every 30 days. A second signup in that window gets the existing report.
  const existing = await latestReportFor(handle);
  if (existing && Date.now() < nextFreeDate(existing.created_at).getTime()) {
    await db()`insert into checkup_requests (brewery, city, ig_handle, name, email, who_posts, source, reused_report, campaign)
      values (${brewery}, ${city}, ${handle}, ${name}, ${email}, ${role}, 'form', ${existing.id}, ${campaign})`;
    alertCheckup('Instagram checkup request (already had a report)', lead, { Note: 'Sent them the existing report; no new one built.' });
    if (existing.status !== 'building') {
      after(() => emailCheckupReport(existing.id, origin, { email, name }).catch((e) => console.error('repeat email failed', e)));
    }
    const when = formatDay(existing.created_at);
    const next = formatDay(nextFreeDate(existing.created_at));
    return NextResponse.json({
      message: `@${handle} already has a free checkup from ${when}, so we've emailed you that report. You can ask for an updated one from the report page starting ${next}.`,
      reportLink: `/checkup/report/${existing.id}`,
      existing: true,
    });
  }

  alertCheckup('Instagram checkup request', lead, { Form: 'Crackem Instagram checkup (/checkup)' });
  const reportId = await startCheckup(lead, 'form', origin);
  const thanks = `Thanks! We'll email the report for @${handle} to ${email} in a few minutes.`;
  // The thank-you screen links straight to the report, which fills in about a minute later.
  return NextResponse.json({ message: thanks, reportLink: `/checkup/report/${reportId}` });
}
