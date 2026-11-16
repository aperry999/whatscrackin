import { NextResponse, type NextRequest } from 'next/server';

// The brewery checkup also runs on its own Crackem address (checkup.crackem.us by default). On that host only the
// checkup pages are served: the home page and anything else go to /checkup, keeping the query (e.g. ?src=cbp).
const CHECKUP_HOST = (process.env.CHECKUP_HOST || 'checkup.crackem.us').toLowerCase();
const ALLOWED = /^\/(checkup|api\/checkup)(\/|$)/;

export function proxy(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim().split(':')[0].toLowerCase();
  if (host !== CHECKUP_HOST) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (ALLOWED.test(pathname)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/checkup';
  // Keep the public host (and the ?src= tag, which clone() carries over) in the redirect.
  url.protocol = 'https:';
  url.host = host;
  url.port = '';
  return NextResponse.redirect(url, pathname === '/' ? 307 : 308);
}

export const config = {
  // Skip Next's own files and static assets.
  matcher: ['/((?!_next/|icon.svg|favicon.ico|robots.txt).*)'],
};
