import { NextResponse } from 'next/server';

export const reply = (message: string, status = 200) => NextResponse.json({ message }, { status });

// Reads a small JSON form body. Bots that fill the hidden "company" field get a fake success.
export async function readForm(req: Request): Promise<Record<string, string> | 'bot' | null> {
  try {
    const text = await req.text();
    if (text.length > 4000) return null;
    const data = JSON.parse(text) as Record<string, unknown>;
    if (typeof data.company === 'string' && data.company.trim()) return 'bot';
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return null;
  }
}

// Best-effort limit per IP per server instance, to slow down scripted floods.
const hits = new Map<string, { n: number; reset: number }>();
export function tooMany(req: Request, max = 20, windowMs = 10 * 60 * 1000) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n += 1;
  return h.n > max;
}
