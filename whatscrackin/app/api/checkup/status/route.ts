import { NextResponse } from 'next/server';
import { db, ready } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Lets the thank-you screen know when a report has finished building. Report ids are unguessable.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{20}$/.test(id)) return NextResponse.json({ status: 'unknown' }, { status: 400 });
  await ready();
  const [r] = await db()<{ status: string }[]>`select status from checkup_reports where id = ${id}`;
  return NextResponse.json({ status: r?.status || 'unknown' }, { headers: { 'Cache-Control': 'no-store' } });
}
