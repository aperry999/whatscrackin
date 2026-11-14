'use client';

import { useState } from 'react';

const OPTIONS: [string, string][] = [
  ['yes', 'Yes'],
  ['boosted', 'Just boosted posts'],
  ['no', 'Not yet'],
];

// One-tap question at the end of a checkup report. The answer tells Crackem who is a warm ads lead.
export function AdsQuestion({ reportId, initial }: { reportId: string; initial: string | null }) {
  const [answer, setAnswer] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function pick(value: string) {
    setBusy(true);
    const res = await fetch('/api/checkup/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: reportId, answer: value }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setAnswer(value);
  }

  return (
    <section className="report-question no-print">
      <h2>One quick question</h2>
      <p>Have you run Instagram or Facebook ads before?</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn sm ${answer === value ? 'btn-accent' : 'btn-ghost'}`}
            disabled={busy}
            aria-pressed={answer === value}
            onClick={() => pick(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {answer && <p className="muted">Thanks, got it. You can change your answer anytime.</p>}
    </section>
  );
}
