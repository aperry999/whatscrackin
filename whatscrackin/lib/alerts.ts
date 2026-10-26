import { after } from 'next/server';
import { db } from './db';
import { sendEmail } from './email';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Who gets signup alerts: ALERT_EMAIL (comma-separated) if set, otherwise every owner in admin.
async function recipients(): Promise<string[]> {
  const set = (process.env.ALERT_EMAIL || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (set.length) return set;
  const rows = await db()<{ email: string }[]>`select email from admins where role = 'owner'`;
  return rows.map((r) => r.email);
}

// Emails the site owners about a signup. Runs after the response is sent, so a mail
// problem never slows down or breaks the visitor's signup.
export function alertOwners(subject: string, details: Record<string, string | null | undefined>) {
  after(async () => {
    try {
      const to = await recipients();
      if (!to.length) return;
      const when = new Date().toLocaleString('en-US', { timeZone: process.env.SITE_TZ || 'America/New_York' });
      const rows = Object.entries({ ...details, Time: `${when} ET` }).filter(([, v]) => v);
      const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
      const html = `<table style="font-family:sans-serif;font-size:15px">${rows
        .map(([k, v]) => `<tr><td style="color:#666;padding:2px 12px 2px 0">${esc(k)}</td><td>${esc(String(v))}</td></tr>`)
        .join('')}</table>`;
      for (const addr of to) await sendEmail(addr, `[What's Crackin'] ${subject}`, text, html);
    } catch (err) {
      console.error('signup alert failed', err);
    }
  });
}
