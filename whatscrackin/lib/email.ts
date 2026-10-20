export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}


// Sends a plain transactional email through SendGrid. Without an API key outside production, it logs instead.
export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM || 'hello@whatscrackin.us';
  if (!key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('SENDGRID_API_KEY is not set');
    console.log(`\n[email not sent: no SENDGRID_API_KEY]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "What's Crackin'" },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
      tracking_settings: { click_tracking: { enable: false, enable_text: false } },
    }),
  });
  if (!res.ok) throw new Error(`SendGrid error ${res.status}: ${await res.text()}`);
}
