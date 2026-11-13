// Instagram Graph API Business Discovery: public data for any Business or Creator account,
// looked up through Crackem's own Instagram account with META_ACCESS_TOKEN.

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;

export type IgPost = {
  id: string;
  timestamp: string;
  type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  likes: number;
  comments: number;
  caption: string;
  permalink: string;
  mediaUrl: string | null;
};

export type IgProfile = {
  username: string;
  name: string;
  bio: string;
  website: string | null;
  followers: number;
  totalPosts: number;
  posts: IgPost[];
};

export class InstagramLookupError extends Error {
  constructor(message: string, public readonly reason: 'not_business' | 'not_found' | 'config' | 'api') {
    super(message);
  }
}

async function graph(path: string): Promise<Record<string, any>> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new InstagramLookupError('META_ACCESS_TOKEN is not set', 'config');
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH()}/${path}${sep}access_token=${encodeURIComponent(token)}`, { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    const msg = String(data?.error?.message || `Graph API error ${res.status}`);
    // Business Discovery answers this way for personal accounts and handles that don't exist.
    if (/business_discovery|cannot be found|Invalid user id/i.test(msg)) throw new InstagramLookupError(msg, 'not_business');
    throw new InstagramLookupError(msg, 'api');
  }
  return data;
}

let cachedIgId: string | null = null;
async function crackemIgId(): Promise<string> {
  if (process.env.IG_BUSINESS_ACCOUNT_ID) return process.env.IG_BUSINESS_ACCOUNT_ID;
  if (cachedIgId) return cachedIgId;
  const pages = await graph('me/accounts?fields=instagram_business_account{id}');
  const id = (pages.data as Array<Record<string, any>> | undefined)?.find((p) => p.instagram_business_account)?.instagram_business_account?.id;
  if (!id) throw new InstagramLookupError('No Instagram Business account is linked to a Page this token can see', 'config');
  cachedIgId = String(id);
  return cachedIgId;
}

export async function lookupInstagram(handle: string, postLimit = 30): Promise<IgProfile> {
  const igId = await crackemIgId();
  const media = `media.limit(${postLimit}){id,timestamp,media_type,like_count,comments_count,caption,permalink,media_url}`;
  const fields = `business_discovery.username(${handle}){username,name,biography,website,followers_count,media_count,${media}}`;
  const data = await graph(`${igId}?fields=${encodeURIComponent(fields)}`);
  const b = data.business_discovery as Record<string, any> | undefined;
  if (!b) throw new InstagramLookupError('No data returned for that handle', 'not_found');
  const posts: IgPost[] = ((b.media?.data as Array<Record<string, any>>) || []).map((m) => ({
    id: String(m.id),
    timestamp: String(m.timestamp),
    type: String(m.media_type),
    likes: Number(m.like_count ?? 0),
    comments: Number(m.comments_count ?? 0),
    caption: String(m.caption || ''),
    permalink: String(m.permalink || ''),
    mediaUrl: m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM' ? (m.media_url ?? null) : null,
  }));
  return {
    username: String(b.username),
    name: String(b.name || b.username),
    bio: String(b.biography || ''),
    website: b.website ? String(b.website) : null,
    followers: Number(b.followers_count ?? 0),
    totalPosts: Number(b.media_count ?? posts.length),
    posts,
  };
}
