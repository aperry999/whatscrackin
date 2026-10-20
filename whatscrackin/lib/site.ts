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
