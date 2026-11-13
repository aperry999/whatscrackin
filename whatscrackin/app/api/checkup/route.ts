import { readForm, reply, tooMany } from '@/lib/api';
import { alertOwners } from '@/lib/alerts';
import { db, ready } from '@/lib/db';
import { cleanEmail } from '@/lib/email';

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
  if (form === 'bot') return reply("Thanks! We'll email your report within a couple of days.");
  if (!form) return reply('Something went wrong. Try again.', 400);

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
  await db()`insert into checkup_requests (brewery, city, ig_handle, name, email, who_posts)
    values (${brewery}, ${city}, ${handle}, ${name}, ${email}, ${role})`;
  alertOwners('Instagram checkup request', {
    Brewery: brewery,
    City: city,
    Instagram: `@${handle} (https://instagram.com/${handle})`,
    Name: name,
    Email: email,
    'Who posts': role,
    Form: 'Crackem Instagram checkup (/checkup)',
  });
  return reply(`Thanks! We'll email the report for @${handle} to ${email} within a couple of days.`);
}
