import { readForm, reply, tooMany } from '@/lib/api';
import { subscribeToBeehiiv } from '@/lib/beehiiv';
import { db, ready } from '@/lib/db';
import { cleanEmail } from '@/lib/email';
import type { City } from '@/lib/cities';

export async function POST(req: Request) {
  if (tooMany(req)) return reply('Too many tries. Wait a few minutes and try again.', 429);
  const form = await readForm(req);
  if (form === 'bot') return reply("You're in. Check your inbox to confirm.");
  if (!form) return reply('Something went wrong. Try again.', 400);

  const email = cleanEmail(form.email);
  if (!email) return reply('Enter a valid email address.', 400);
  await ready();

  const [city] = await db()<City[]>`select * from cities where slug = ${form.city || ''} and status = 'live'`;
  if (!city) return reply('Pick a city from the list.', 400);

  try {
    await subscribeToBeehiiv(email, city.beehiiv_tag || city.name, city.name);
  } catch (err) {
    console.error(err);
    return reply("We couldn't sign you up just now. Try again in a minute.", 502);
  }
  return reply(`You're in for ${city.name}. Check your inbox to confirm.`);
}
