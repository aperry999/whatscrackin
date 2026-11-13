import { NextResponse } from 'next/server';

// Temporary, preview-only check that the Meta token works for Instagram Business Discovery.
// Returns only public Instagram data and yes/no for each setting; never the token itself.
export const dynamic = 'force-dynamic';

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;

async function graph(path: string, token: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === 'production') return new Response('Not found', { status: 404 });

  const token = process.env.META_ACCESS_TOKEN || '';
  const settings = {
    META_ACCESS_TOKEN: Boolean(token),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    IG_BUSINESS_ACCOUNT_ID: Boolean(process.env.IG_BUSINESS_ACCOUNT_ID),
  };
  if (!token) return NextResponse.json({ settings, error: 'META_ACCESS_TOKEN is not set for this environment.' });

  // 1. Which Facebook Pages and Instagram accounts can the token reach?
  const pages = await graph('me/accounts?fields=name,instagram_business_account{id,username}', token);
  const me = await graph('me?fields=id,name', token);
  const igAccounts = ((pages.data.data as Array<Record<string, any>>) || [])
    .filter((p) => p.instagram_business_account)
    .map((p) => ({ page: p.name, ig_id: p.instagram_business_account.id, ig_username: p.instagram_business_account.username }));
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID || igAccounts[0]?.ig_id;

  const result: Record<string, unknown> = {
    settings,
    token_user: me.ok ? me.data : { error: me.data.error },
    instagram_accounts_found: igAccounts,
    pages_error: pages.ok ? undefined : pages.data.error,
  };
  if (!igId) return NextResponse.json({ ...result, error: 'No Instagram Business account is linked to a Page this token can see.' });

  // 2. Look up another account's public data.
  const handle = (new URL(req.url).searchParams.get('handle') || 'instagram').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30);
  const fields = `business_discovery.username(${handle}){username,name,biography,followers_count,media_count,media.limit(12){timestamp,media_type,like_count,comments_count,permalink}}`;
  const bd = await graph(`${igId}?fields=${encodeURIComponent(fields)}`, token);
  if (!bd.ok) return NextResponse.json({ ...result, lookup_handle: handle, lookup_ok: false, lookup_error: bd.data.error });

  const b = bd.data.business_discovery as Record<string, any>;
  const posts = (b?.media?.data || []) as Array<Record<string, any>>;
  return NextResponse.json({
    ...result,
    lookup_handle: handle,
    lookup_ok: true,
    profile: { username: b.username, name: b.name, followers: b.followers_count, posts: b.media_count, bio: b.biography },
    recent_posts: posts.map((p) => ({ date: p.timestamp, type: p.media_type, likes: p.like_count, comments: p.comments_count, link: p.permalink })),
  });
}
