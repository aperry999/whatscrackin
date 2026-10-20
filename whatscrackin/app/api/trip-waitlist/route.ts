import { readForm, reply, tooMany } from '@/lib/api';
import { db } from '@/lib/db';
import { cleanEmail } from '@/lib/email';

export async function POST(req: Request) {
  if (tooMany(req)) return reply('Too many tries. Wait a few minutes and try again.', 429);
  const form = await readForm(req);
  if (form === 'bot') return reply("You're on the list. We'll email you when trip lists launch.");
  if (!form) return reply('Something went wrong. Try again.', 400);

  const email = cleanEmail(form.email);
  if (!email) return reply('Enter a valid email address.', 400);
  const city = (form.city || '').replace(/[<>{}\\]/g, '').trim().slice(0, 80) || null;

  await db()`insert into trip_waitlist (email, city) values (${email}, ${city})
    on conflict (email) do update set city = coalesce(excluded.city, trip_waitlist.city)`;
  return reply("You're on the list. We'll email you the day trip lists launch.");
}
