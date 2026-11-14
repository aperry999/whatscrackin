import { readForm, reply, tooMany } from '@/lib/api';
import { alertOwners } from '@/lib/alerts';
import { db, ready } from '@/lib/db';

const LABELS: Record<string, string> = { yes: 'Yes', no: 'No', boosted: 'Just boosted posts' };

// Saves the brewery's answer to "Have you run Instagram or Facebook ads before?" from its report page.
export async function POST(req: Request) {
  if (tooMany(req)) return reply('Too many tries. Wait a few minutes and try again.', 429);
  const form = await readForm(req);
  if (!form || form === 'bot') return reply('Something went wrong. Try again.', 400);
  const id = form.report || '';
  const answer = form.answer || '';
  if (!/^[a-f0-9]{20}$/.test(id) || !LABELS[answer]) return reply('Something went wrong. Try again.', 400);
  await ready();
  const [row] = await db()<{ brewery: string; ig_handle: string; email: string; previous: string | null }[]>`
    update checkup_reports rep set ran_ads = ${answer}
    from checkup_requests req, (select ran_ads as previous from checkup_reports where id = ${id}) old
    where rep.id = ${id} and req.id = rep.request_id
    returning req.brewery, req.ig_handle, req.email, old.previous`;
  if (!row) return reply('Report not found.', 404);
  if (row.previous !== answer) {
    alertOwners('Checkup: brewery answered the ads question', {
      Brewery: `${row.brewery} (@${row.ig_handle})`,
      'Run ads before?': LABELS[answer],
      Email: row.email,
    });
  }
  return reply('Thanks!');
}
