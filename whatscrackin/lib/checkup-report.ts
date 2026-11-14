import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { sendOwnerAlert } from './alerts';
import { db, ready } from './db';
import { sendEmail } from './email';
import { siteUrl } from './site';
import { InstagramLookupError, lookupInstagram, type IgPost, type IgProfile } from './instagram';

const TZ = process.env.SITE_TZ || 'America/New_York';
const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------- Metrics (computed here, never by the model) ----------

export type PostSummary = {
  index: number;
  date: string;
  type: string;
  likes: number;
  comments: number;
  engagement: number;
  caption: string;
  permalink: string;
  mediaUrl: string | null;
};

export type CheckupMetrics = {
  username: string;
  name: string;
  bio: string;
  website: string | null;
  followers: number;
  totalPosts: number;
  postsAnalyzed: number;
  daysCovered: number;
  postsLast30Days: number;
  postsPerWeek: number;
  daysSinceLastPost: number | null;
  longestGapDays: number;
  avgLikes: number;
  avgComments: number;
  engagementRatePct: number;
  byType: { type: string; posts: number; sharePct: number; avgEngagement: number }[];
  byWeekday: { day: string; posts: number; avgEngagement: number }[];
  captions: { avgLength: number; pctWithQuestion: number; pctWithDateOrTime: number; avgHashtags: number };
  bio_checks: { mentionsHours: boolean; hasWebsite: boolean };
  topPosts: PostSummary[];
  bottomPosts: PostSummary[];
};

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const TYPE_LABEL: Record<string, string> = { IMAGE: 'Photo', VIDEO: 'Reel or video', CAROUSEL_ALBUM: 'Carousel' };
const DATE_OR_TIME = /\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\btonight\b|\btomorrow\b|\b\d{1,2}\/\d{1,2}\b/i;

function weekday(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ });
}

export function computeMetrics(p: IgProfile, now = Date.now()): CheckupMetrics {
  const posts = [...p.posts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const times = posts.map((x) => Date.parse(x.timestamp));
  const eng = (x: IgPost) => x.likes + x.comments;

  let longestGap = 0;
  for (let i = 1; i < times.length; i++) longestGap = Math.max(longestGap, (times[i - 1] - times[i]) / DAY);
  if (times.length) longestGap = Math.max(longestGap, (now - times[0]) / DAY);
  const last30 = times.filter((t) => now - t <= 30 * DAY).length;
  // If we fetched fewer posts than they've made and the oldest one is inside the 30 days,
  // measure the rate over the days we can actually see.
  const oldest = times.length ? times[times.length - 1] : now;
  const rateDays = p.totalPosts > posts.length && now - oldest < 30 * DAY ? Math.max(1, (now - oldest) / DAY) : 30;

  const summaries: PostSummary[] = posts.map((x, i) => ({
    index: i,
    date: x.timestamp.slice(0, 10),
    type: TYPE_LABEL[x.type] || x.type,
    likes: x.likes,
    comments: x.comments,
    engagement: eng(x),
    caption: x.caption.slice(0, 300),
    permalink: x.permalink,
    mediaUrl: x.mediaUrl,
  }));
  const ranked = [...summaries].sort((a, b) => b.engagement - a.engagement);

  const types = [...new Set(posts.map((x) => x.type))];
  const byType = types
    .map((t) => {
      const ps = posts.filter((x) => x.type === t);
      return { type: TYPE_LABEL[t] || t, posts: ps.length, sharePct: round((ps.length / posts.length) * 100, 0), avgEngagement: round(avg(ps.map(eng))) };
    })
    .sort((a, b) => b.posts - a.posts);

  const byWeekday = WEEKDAYS.map((day) => {
    const ps = posts.filter((x) => weekday(x.timestamp) === day);
    return { day, posts: ps.length, avgEngagement: round(avg(ps.map(eng))) };
  }).filter((d) => d.posts > 0);

  const caps = posts.map((x) => x.caption);
  const pct = (f: (c: string) => boolean) => (caps.length ? round((caps.filter(f).length / caps.length) * 100, 0) : 0);
  const avgEng = avg(posts.map(eng));

  return {
    username: p.username,
    name: p.name,
    bio: p.bio,
    website: p.website,
    followers: p.followers,
    totalPosts: p.totalPosts,
    postsAnalyzed: posts.length,
    daysCovered: times.length > 1 ? Math.max(1, Math.round((times[0] - times[times.length - 1]) / DAY)) : 0,
    postsLast30Days: last30,
    postsPerWeek: round((last30 / rateDays) * 7),
    daysSinceLastPost: times.length ? Math.floor((now - times[0]) / DAY) : null,
    longestGapDays: Math.floor(longestGap),
    avgLikes: round(avg(posts.map((x) => x.likes))),
    avgComments: round(avg(posts.map((x) => x.comments))),
    engagementRatePct: p.followers ? round((avgEng / p.followers) * 100, 2) : 0,
    byType,
    byWeekday,
    captions: {
      avgLength: Math.round(avg(caps.map((c) => c.length))),
      pctWithQuestion: pct((c) => c.includes('?')),
      pctWithDateOrTime: pct((c) => DATE_OR_TIME.test(c)),
      avgHashtags: round(avg(caps.map((c) => (c.match(/#\w+/g) || []).length))),
    },
    bio_checks: {
      mentionsHours: /\b\d{1,2}\s?(am|pm)?\s?[-–]\s?\d{1,2}\b|\bhours\b|\bopen\b/i.test(p.bio),
      hasWebsite: Boolean(p.website),
    },
    topPosts: ranked.slice(0, 3),
    bottomPosts: ranked.slice(-3).reverse(),
  };
}

// ---------- Written report (Claude) ----------

const ReportContent = z.object({
  headline: z.string().describe('One plain sentence: the single most important thing about their Instagram right now.'),
  owner_summary: z.string().describe('Two sentences for the brewery owner: where they stand and the one change that matters most.'),
  working: z.array(z.object({ title: z.string(), detail: z.string() })).describe('1 to 3 things that are working, each tied to a number or a specific post.'),
  fixes: z.array(z.object({ title: z.string(), detail: z.string() })).describe('2 to 4 things holding them back, each tied to a number or a specific post.'),
  tasks: z
    .array(z.object({ title: z.string(), how: z.string(), minutes: z.number().int() }))
    .describe('Exactly 3 tasks for this month. Each doable on a phone in under 30 minutes by a bartender or taproom manager.'),
  captions: z
    .array(z.object({ for_what: z.string(), caption: z.string() }))
    .describe('3 ready-to-post captions in their voice, for things they clearly do (events or releases seen in their posts).'),
  mock_ad: z.object({
    post_index: z.number().int().describe('index of the top post to build the ad from'),
    headline: z.string(),
    primary_text: z.string(),
    call_to_action: z.string().describe('A Meta ad button label, e.g. Get directions, Learn more, Get tickets'),
    audience: z.string().describe('Who to show it to, e.g. adults 21+ within 10 miles who like craft beer'),
  }),
});
export type CheckupContent = z.infer<typeof ReportContent>;

const SYSTEM = `You write Crackem's free Instagram checkup for craft breweries.

The reader is usually a bartender or taproom manager who posts between shifts, not a marketer. The owner reads only the summary. Write like a friendly regular who knows marketing: plain words, short sentences, no jargon. If you must use a term like "engagement", explain it in a few words.

Every claim must come from the numbers or posts you are given; cite the number or the post date. Never invent follower counts, benchmarks, events, prices or results. If the data is thin (few posts), say so and keep advice general.

Tasks must be small and concrete ("Film a 10-second pour of your next release and post it Thursday at 4 pm"), not "post more consistently".

Captions should sound like the brewery's own recent captions and fit what they actually do.

The mock ad builds on one of their top posts and promotes something they clearly offer (an event, release or the taproom itself). Keep primary_text under 125 characters.`;

function userPrompt(m: CheckupMetrics, recentCaptions: string[]) {
  const { topPosts, bottomPosts, ...rest } = m;
  const strip = (ps: PostSummary[]) => ps.map(({ mediaUrl, ...x }) => x);
  return `Brewery: ${m.name} (@${m.username})

Metrics (computed from their last ${m.postsAnalyzed} posts, dates in ${TZ}):
${JSON.stringify(rest, null, 2)}

Top posts by likes + comments (post_index refers to this list, 0-2):
${JSON.stringify(strip(topPosts).map((p, i) => ({ ...p, index: i })), null, 2)}

Lowest posts:
${JSON.stringify(strip(bottomPosts), null, 2)}

Recent captions, newest first:
${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Images of their top photo posts are attached when available.

Write the checkup.`;
}

async function writeReport(m: CheckupMetrics, recentCaptions: string[]): Promise<CheckupContent> {
  const client = new Anthropic();
  const images = m.topPosts.filter((p) => p.mediaUrl).slice(0, 3);

  const run = (withImages: boolean) =>
    client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(ReportContent) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...(withImages ? images.map((p) => ({ type: 'image' as const, source: { type: 'url' as const, url: p.mediaUrl! } })) : []),
            { type: 'text' as const, text: userPrompt(m, recentCaptions) },
          ],
        },
      ],
    });

  let res;
  try {
    res = await run(images.length > 0);
  } catch (err) {
    // Instagram image links expire and can't always be fetched; try again on the text alone.
    if (images.length && err instanceof Anthropic.BadRequestError) res = await run(false);
    else throw err;
  }
  if (res.stop_reason === 'refusal') throw new Error('The report writer declined this request.');
  if (res.stop_reason === 'max_tokens') throw new Error('The report was cut off before it finished.');
  if (!res.parsed_output) throw new Error('The report came back in an unexpected format.');
  return res.parsed_output;
}

// ---------- Orchestration ----------

export const newReportId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);

export const reportUrl = (id: string) => `${siteUrl()}/checkup/report/${id}`;

// Builds (or rebuilds) the report for one checkup request and stores it as a draft for review.
// Emails the brewery its report link and marks the report sent.
export async function emailCheckupReport(reportId: string): Promise<{ email: string }> {
  await ready();
  const [r] = await db()<{ id: string; status: string; email: string; name: string; brewery: string; ig_handle: string }[]>`
    select rep.id, rep.status, req.email, req.name, req.brewery, req.ig_handle
    from checkup_reports rep join checkup_requests req on req.id = rep.request_id where rep.id = ${reportId}`;
  if (!r) throw new Error('Report not found.');
  if (r.status === 'failed' || r.status === 'building') throw new Error('That report is not ready. Rebuild it first.');
  const link = reportUrl(r.id);
  const first = r.name.split(/\s+/)[0] || 'there';
  const esc = (v: string) => v.replace(/[<>&]/g, '');
  const text = `Hi ${first},\n\nYour free Instagram checkup for ${r.brewery} (@${r.ig_handle}) is ready:\n${link}\n\nIt covers what's working, what's holding you back, three things to try this month, and a sample event ad built from one of your own posts.\n\nQuestions? Just reply to this email.\n\nCrackem`;
  const html = `<p>Hi ${esc(first)},</p><p>Your free Instagram checkup for <b>${esc(r.brewery)}</b> (@${r.ig_handle}) is ready.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#E8A33D;color:#1A1206;text-decoration:none;border-radius:6px;font-weight:600">See your report</a></p><p>It covers what's working, what's holding you back, three things to try this month, and a sample event ad built from one of your own posts.</p><p>Questions? Just reply to this email.</p><p>Crackem</p>`;
  await sendEmail(r.email, `Your Instagram checkup for ${r.brewery}`, text, html, 'Crackem');
  await db()`update checkup_reports set status = 'sent', sent_at = now() where id = ${r.id}`;
  return { email: r.email };
}

// Builds (or rebuilds) the report for a request. With autoSend, a successful report is emailed to the brewery right away.
export async function buildCheckupReport(
  requestId: number,
  { autoSend = false }: { autoSend?: boolean } = {},
): Promise<{ id: string; status: 'draft' | 'sent' | 'failed' }> {
  await ready();
  const [req] = await db()<{ id: number; brewery: string; ig_handle: string }[]>`
    select id, brewery, ig_handle from checkup_requests where id = ${requestId}`;
  if (!req) throw new Error(`No checkup request ${requestId}`);

  const [existing] = await db()<{ id: string }[]>`select id from checkup_reports where request_id = ${requestId}`;
  const id = existing?.id || newReportId();

  let status: 'draft' | 'failed' = 'draft';
  let metrics: CheckupMetrics | null = null;
  let content: CheckupContent | null = null;
  let error: string | null = null;
  try {
    const profile = await lookupInstagram(req.ig_handle);
    metrics = computeMetrics(profile);
    if (metrics.postsAnalyzed === 0) throw new InstagramLookupError('This account has no posts yet.', 'not_found');
    const recent = [...profile.posts]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 15)
      .map((p) => p.caption.replace(/\s+/g, ' ').slice(0, 300))
      .filter(Boolean);
    content = await writeReport(metrics, recent);
  } catch (err) {
    status = 'failed';
    error =
      err instanceof InstagramLookupError && err.reason === 'not_business'
        ? `@${req.ig_handle} isn't a Business or Creator account, or the handle is wrong. (${err.message})`
        : err instanceof Error
          ? err.message
          : String(err);
    console.error('checkup report failed', requestId, err);
  }

  await db()`
    insert into checkup_reports (id, request_id, status, metrics, content, error)
    values (${id}, ${requestId}, ${status}, ${metrics ? db().json(metrics as any) : null}, ${content ? db().json(content as any) : null}, ${error})
    on conflict (request_id) do update set
      status = excluded.status, metrics = excluded.metrics, content = excluded.content,
      error = excluded.error, updated_at = now(), sent_at = null`;

  let finalStatus: 'draft' | 'sent' | 'failed' = status;
  let sendError: string | null = null;
  if (status === 'draft' && autoSend) {
    try {
      await emailCheckupReport(id);
      finalStatus = 'sent';
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
      console.error('checkup report email failed', requestId, err);
    }
  }

  const subject =
    finalStatus === 'sent' ? 'Checkup report sent' : finalStatus === 'failed' ? 'Checkup report failed' : sendError ? 'Checkup report built but email failed' : 'Checkup report ready to review';
  await sendOwnerAlert(subject, {
    Brewery: req.brewery,
    Instagram: `@${req.ig_handle}`,
    Report: finalStatus === 'failed' ? null : reportUrl(id),
    Problem: error || sendError,
    Next:
      finalStatus === 'sent'
        ? 'Nothing to do. The brewery has the link.'
        : finalStatus === 'failed'
          ? 'Fix the handle or try again from admin.'
          : 'Send it from admin.',
  }).catch((e) => console.error('report alert failed', e));

  return { id, status: finalStatus };
}
