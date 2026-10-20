'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { consumeLoginToken, createLoginToken, endSession, getAdmin, siteUrl, startSession, type Admin } from '@/lib/auth';
import { findOrCreateCity, parseCityInput } from '@/lib/cities';
import { db, ready } from '@/lib/db';
import { cleanEmail, sendEmail } from '@/lib/email';
import { saveSettings } from '@/lib/settings';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optInt = (v: string) => {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const optNum = (v: string) => {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

async function requireAdmin(role?: 'owner'): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  if (role === 'owner' && admin.role !== 'owner') redirect('/admin?msg=' + encodeURIComponent('Only owners can do that.'));
  return admin;
}

function done(msg: string): never {
  revalidatePath('/admin');
  revalidatePath('/');
  redirect('/admin?msg=' + encodeURIComponent(msg));
}

function loginEmail(link: string, intro: string) {
  const text = `${intro}\n\nSign in here (the link works once and expires in 20 minutes):\n${link}\n\nIf you didn't ask for this, you can ignore it.`;
  const html = `<p>${intro}</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#E8A33D;color:#1A1206;text-decoration:none;border-radius:6px;font-weight:600">Sign in to What's Crackin' admin</a></p><p style="color:#5B606A;font-size:13px">The link works once and expires in 20 minutes. If you didn't ask for this, you can ignore it.</p>`;
  return { text, html };
}

// --- Sign-in ---

export async function sendLoginLink(formData: FormData) {
  const email = cleanEmail(formData.get('email'));
  if (email) {
    await ready();
    const [admin] = await db()`select email from admins where email = ${email}`;
    if (admin) {
      const token = await createLoginToken(email);
      const { text, html } = loginEmail(`${siteUrl()}/admin/verify?token=${token}`, "Here's your sign-in link for the What's Crackin' admin.");
      try {
        await sendEmail(email, "Your What's Crackin' sign-in link", text, html);
      } catch (err) {
        console.error(err);
        redirect('/admin/login?error=send');
      }
    }
  }
  // Same answer either way, so the form can't be used to find out who has access.
  redirect('/admin/login?sent=1');
}

export async function signIn(formData: FormData) {
  const admin = await consumeLoginToken(str(formData, 'token'));
  if (!admin) redirect('/admin/login?error=expired');
  await startSession(admin.email);
  redirect('/admin');
}

export async function signOut() {
  await endSession();
  redirect('/admin/login');
}

// --- Cities ---

export async function updateCity(formData: FormData) {
  await requireAdmin();
  const id = optInt(str(formData, 'id'));
  if (!id) done('City not found.');
  const status = str(formData, 'status') === 'live' ? 'live' : 'waiting';
  const goal = optInt(str(formData, 'goal'));
  const breweries = optInt(str(formData, 'brewery_count'));
  const tag = str(formData, 'beehiiv_tag').slice(0, 60) || null;
  const lat = optNum(str(formData, 'lat'));
  const lng = optNum(str(formData, 'lng'));
  const [row] = await db()<{ name: string }[]>`
    update cities set
      status = ${status},
      goal = ${goal},
      brewery_count = ${breweries},
      beehiiv_tag = ${tag},
      lat = ${lat},
      lng = ${lng},
      launched_at = case when ${status} = 'live' then coalesce(launched_at, now()) else launched_at end
    where id = ${id}
    returning name`;
  done(row ? `Saved ${row.name}.` : 'City not found.');
}

export async function deleteCity(formData: FormData) {
  await requireAdmin();
  const id = optInt(str(formData, 'id'));
  if (formData.get('confirmDelete') !== 'yes') done('Tick the confirm box to delete a city.');
  const [row] = await db()<{ name: string }[]>`delete from cities where id = ${id} returning name`;
  done(row ? `Deleted ${row.name} and its requests.` : 'City not found.');
}

export async function addCity(formData: FormData) {
  await requireAdmin();
  const parsed = parseCityInput(str(formData, 'city'));
  if ('error' in parsed) done(parsed.error);
  const city = await findOrCreateCity(parsed);
  done(`${city.name}, ${city.state} is in the list.`);
}

// --- Settings (owners) ---

export async function updateSettings(formData: FormData) {
  await requireAdmin('owner');
  const defaultGoal = optInt(str(formData, 'default_goal')) ?? 100;
  const revealPct = Math.min(100, optInt(str(formData, 'reveal_pct')) ?? 75);
  await saveSettings({ defaultGoal, revealPct, suggestFromBreweries: formData.get('suggest') === 'on' });
  done('Settings saved.');
}

// --- Team (owners) ---

export async function inviteAdmin(formData: FormData) {
  const me = await requireAdmin('owner');
  const email = cleanEmail(formData.get('email'));
  if (!email) done('Enter a valid email address.');
  const role = str(formData, 'role') === 'owner' ? 'owner' : 'editor';
  await db()`insert into admins (email, role, invited_by) values (${email}, ${role}, ${me.email})
    on conflict (email) do update set role = excluded.role`;
  const token = await createLoginToken(email);
  const { text, html } = loginEmail(
    `${siteUrl()}/admin/verify?token=${token}`,
    `${me.email} added you to the What's Crackin' admin as ${role === 'owner' ? 'an owner' : 'an editor'}. After this link expires, sign in any time at ${siteUrl()}/admin/login.`,
  );
  try {
    await sendEmail(email, "You've been added to What's Crackin' admin", text, html);
  } catch (err) {
    console.error(err);
    done(`Added ${email}, but the invite email didn't send. They can sign in at /admin/login.`);
  }
  done(`Invited ${email}.`);
}

export async function removeAdmin(formData: FormData) {
  const me = await requireAdmin('owner');
  const email = cleanEmail(formData.get('email'));
  if (!email || email === me.email) done("You can't remove yourself.");
  const [{ owners }] = await db()<{ owners: number }[]>`select count(*)::int as owners from admins where role = 'owner' and email <> ${email}`;
  if (owners < 1) done('Keep at least one owner.');
  await db()`delete from admins where email = ${email}`;
  done(`Removed ${email}.`);
}
