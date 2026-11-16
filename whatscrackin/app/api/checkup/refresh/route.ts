import { NextResponse } from 'next/server';
import { readForm, reply, tooMany } from '@/lib/api';
import { formatDay, latestReportFor, nextFreeDate } from '@/lib/checkup-report';
import { alertCheckup, startCheckup } from '@/lib/checkup-start';
import { db, ready } from '@/lib/db';
import { currentOrigin } from '@/lib/site';

export const maxDuration = 300;

// "Get an updated report" on a report page. Builds a fresh report for the same brewery once 30 days have passed.
// Asking is the signal: the owner is alerted, since a brewery coming back for more is a warm lead.
export async function POST(req: Request) {
  if (tooMany(req)) return reply('Too many tries. Wait a few minutes and try again.', 429);
  const form = await readForm(req);
  if (!form || form === 'bot') return reply('Something went wrong. Try again.', 400);
  const id = form.report || '';
  if (!/^[a-f0-9]{20}$/.test(id)) return reply('Something went wrong. Try again.', 400);
  await ready();
  const [r] = await db()<{ brewery: string; city: string; ig_handle: string; name: string; email: string; who_posts: string | null; campaign: string | null }[]>`
    select req.brewery, req.city, req.ig_handle, req.name, req.email, req.who_posts, req.campaign
    from checkup_reports rep join checkup_requests req on req.id = rep.request_id where rep.id = ${id}`;
  if (!r) return reply('Report not found.', 404);

  const latest = await latestReportFor(r.ig_handle);
  if (latest && latest.id !== id) {
    return NextResponse.json({ message: 'There is already a newer report for this account.', reportLink: `/checkup/report/${latest.id}` });
  }
  if (latest && Date.now() < nextFreeDate(latest.created_at).getTime()) {
    return reply(`Your next free update is available on ${formatDay(nextFreeDate(latest.created_at))}.`, 429);
  }

  const lead = { brewery: r.brewery, city: r.city, handle: r.ig_handle, name: r.name, email: r.email, role: r.who_posts, campaign: r.campaign };
  alertCheckup('Checkup refresh requested', lead, { Note: 'They asked for an updated report from their report page.' });
  const reportId = await startCheckup(lead, 'refresh', await currentOrigin());
  return NextResponse.json({ message: 'Building your updated report.', reportLink: `/checkup/report/${reportId}` });
}
