import { db, ready } from '@/lib/db';

// Serves the stored copy of the post picture used in a report's sample ad.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{20}$/.test(id)) return new Response('Not found', { status: 404 });
  await ready();
  const [r] = await db()<{ ad_image: Buffer | null; ad_image_type: string | null }[]>`
    select ad_image, ad_image_type from checkup_reports where id = ${id}`;
  if (!r?.ad_image || !r.ad_image_type?.startsWith('image/')) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(r.ad_image), {
    headers: { 'Content-Type': r.ad_image_type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}
