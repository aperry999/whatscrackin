'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { parseBenchmarkInput, pullBenchmarks, saveBenchmarkBreweries } from '@/lib/benchmarks';
import { db, ready } from '@/lib/db';

const back = (msg: string): never => {
  revalidatePath('/admin/benchmarks');
  redirect('/admin/benchmarks?msg=' + encodeURIComponent(msg));
};

async function requireAdmin() {
  if (!(await getAdmin())) redirect('/admin/login');
}

export async function addBenchmarkBreweries(formData: FormData) {
  await requireAdmin();
  let text = String(formData.get('handles') ?? '');
  const file = formData.get('file');
  if (file && typeof file === 'object' && 'text' in file && file.size > 0) {
    if (file.size > 2_000_000) back('That file is too big. Keep it under 2 MB.');
    text += '\n' + (await file.text());
  }
  const { rows, skipped } = parseBenchmarkInput(text, String(formData.get('city') ?? ''), String(formData.get('state') ?? ''));
  if (!rows.length) back(skipped.length ? `No handles found. Couldn't read: ${skipped.slice(0, 5).join(' · ')}` : 'Paste some handles first.');
  const { added, updated } = await saveBenchmarkBreweries(rows);
  back(
    `Added ${added}${updated ? `, updated ${updated} already on the list` : ''}.` +
      (skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 5).join(' · ')}${skipped.length > 5 ? ' …' : ''}` : '') +
      ' Press "Pull numbers" to fetch them.',
  );
}

const PULL_KEY = 'benchmark_pull';

export async function pullBenchmarkNumbers(formData: FormData) {
  await requireAdmin();
  await ready();
  const force = formData.get('force') === 'yes';
  const [running] = await db()<{ value: string }[]>`select value from settings where key = ${PULL_KEY}`;
  if (running?.value.startsWith('running:') && Date.now() - Number(running.value.slice(8)) < 6 * 60_000) {
    back('A pull is already running. Refresh this page in a few minutes.');
  }
  await db()`insert into settings (key, value) values (${PULL_KEY}, ${'running:' + Date.now()})
    on conflict (key) do update set value = excluded.value`;
  after(async () => {
    let result: string;
    try {
      const r = await pullBenchmarks({ force });
      result =
        `Last pull: ${r.ok} updated, ${r.failed} failed.` +
        (r.rateLimited ? ' Stopped at Meta’s hourly limit; press Pull numbers again in an hour.' : r.left ? ` ${r.left} still to go; press Pull numbers again.` : ' All done.');
    } catch (err) {
      result = `Last pull failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    await db()`update settings set value = ${'done:' + new Date().toISOString() + ':' + result} where key = ${PULL_KEY}`;
  });
  back('Pulling numbers in the background, about 2 seconds per brewery. Refresh this page in a few minutes.');
}

export async function removeBenchmarkBrewery(formData: FormData) {
  await requireAdmin();
  const handle = String(formData.get('handle') ?? '');
  await db()`delete from benchmark_breweries where handle = ${handle}`;
  back(`Removed @${handle}.`);
}
