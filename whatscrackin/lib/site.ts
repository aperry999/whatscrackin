// The site's public address from SITE_URL, accepting it with or without "https://" and a trailing slash.
export function siteUrl() {
  let raw = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return 'http://localhost:3000';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    return new URL(raw).origin;
  } catch {
    return 'https://whatscrackin.us';
  }
}

// The address the person is using right now (e.g. the vercel.app address before the domain is pointed),
// so emailed links open the same site. Only trusted hosts are used; anything else falls back to SITE_URL.
export async function currentOrigin() {
  const { headers } = await import('next/headers');
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim().toLowerCase();
  const configured = new URL(siteUrl()).host;
  const trusted =
    host === configured ||
    host === checkupHost() ||
    host === 'www.' + configured ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/.test(host) ||
    /^localhost(:\d+)?$/.test(host);
  if (!host || !trusted) return siteUrl();
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

// The brewery checkup's own address (see proxy.ts). Trusted for emailed links like the main site's.
export const checkupHost = () => (process.env.CHECKUP_HOST || 'checkup.crackem.us').toLowerCase();

// Where checkup report links point. With CHECKUP_SITE_URL set (e.g. https://checkup.crackem.us once its DNS works),
// every report link uses it, including ones sent from admin. Otherwise links use the address the person is on.
export function checkupOrigin(fallback?: string) {
  const raw = (process.env.CHECKUP_SITE_URL || '').trim().replace(/\/+$/, '');
  if (raw) {
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw).origin;
    } catch {
      // fall through
    }
  }
  return fallback || siteUrl();
}
