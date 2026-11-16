import { after } from 'next/server';
import { alertOwners } from './alerts';
import { buildCheckupReport, newReportId } from './checkup-report';
import { db, ready } from './db';

export type CheckupLead = { brewery: string; city: string; handle: string; name: string; email: string; role: string | null };

// Records a request and starts building its report in the background (it's emailed when done).
// Returns the new report's id. Call from a route handler: after() runs once the response is sent.
export async function startCheckup(lead: CheckupLead, source: 'form' | 'refresh', origin: string): Promise<string> {
  await ready();
  const [row] = await db()<{ id: number }[]>`
    insert into checkup_requests (brewery, city, ig_handle, name, email, who_posts, source)
    values (${lead.brewery}, ${lead.city}, ${lead.handle}, ${lead.name}, ${lead.email}, ${lead.role}, ${source}) returning id`;
  const reportId = newReportId();
  await db()`insert into checkup_reports (id, request_id, status) values (${reportId}, ${row.id}, 'building')`;
  after(async () => {
    try {
      await buildCheckupReport(row.id, { autoSend: true, origin });
    } catch (err) {
      console.error('checkup report build failed', err);
    }
  });
  return reportId;
}

export function alertCheckup(subject: string, lead: CheckupLead, extra: Record<string, string | null> = {}) {
  alertOwners(subject, {
    Brewery: lead.brewery,
    City: lead.city,
    Instagram: `@${lead.handle} (https://instagram.com/${lead.handle})`,
    Name: lead.name,
    Email: lead.email,
    'Who posts': lead.role,
    ...extra,
  });
}
