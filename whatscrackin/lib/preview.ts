// True on Vercel preview deployments. VERCEL_ENV is only set when the project exposes
// system environment variables, so also treat any *.vercel.app host other than the
// production one as a preview.
const PRODUCTION_HOSTS = ['whatscrackin.vercel.app'];

export function isPreview(host: string | null | undefined): boolean {
  if (process.env.VERCEL_ENV === 'preview') return true;
  if (process.env.VERCEL_ENV === 'production') return false;
  const h = (host || '').split(':')[0].toLowerCase();
  return h.endsWith('.vercel.app') && !PRODUCTION_HOSTS.includes(h);
}
