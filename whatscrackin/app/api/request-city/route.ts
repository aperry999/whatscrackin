import { readForm, reply, tooMany } from '@/lib/api';
import { subscribeToBeehiiv } from '@/lib/beehiiv';
import { findOrCreateCity, parseCityInput } from '@/lib/cities';
import { db } from '@/lib/db';
import { cleanEmail } from '@/lib/email';

export async function POST(req: Request) {
  if (tooMany(req)) return reply('Too many tries. Wait a few minutes and try again.', 429);
  const form = await readForm(req);
  if (form === 'bot') return reply("You're on the list. We'll email you the day your city launches.");
  if (!form) return reply('Something went wrong. Try again.', 400);

  const email = cleanEmail(form.email);
  if (!email) return reply('Enter a valid email address.', 400);
  const parsed = parseCityInput(form.city || '');
  if ('error' in parsed) return reply(parsed.error, 400);

  const city = await findOrCreateCity(parsed);

  // Asked for a city that's already live: subscribe them instead.
  if (city.status === 'live') {
    try {
      await subscribeToBeehiiv(email, city.beehiiv_tag || city.name);
    } catch (err) {
      console.error(err);
      return reply("We couldn't sign you up just now. Try again in a minute.", 502);
    }
    return reply(`Good news: ${city.name} is already live. You're subscribed, so check your inbox to confirm.`);
  }

  const inserted = await db()`
    insert into city_requests (city_id, email) values (${city.id}, ${email})
    on conflict (city_id, email) do nothing
    returning id`;
  const label = `${city.name}, ${city.state}`;
  if (!inserted.length) return reply(`You already asked for ${label}. We'll email you the day it launches.`);
  return reply(`You're on the list for ${label}. Share it with friends there to get it launched sooner.`);
}
