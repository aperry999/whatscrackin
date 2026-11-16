'use client';

import { useEffect, useState } from 'react';

type Phase = 'working' | 'ready' | 'failed' | 'slow';

// Shown after a checkup signup while the report builds (about 45 seconds). Steps advance on a timer
// so there is something to watch, but the button only appears once the server says the report is done.
export function ReportProgress({ link, handle, onReady }: { link: string; handle: string; onReady?: () => void }) {
  const steps = [
    `Finding @${handle} on Instagram`,
    'Reading your last 30 posts',
    'Counting likes and comments',
    'Spotting your best days and post types',
    'Writing three things to try this month',
    'Building a sample ad from your best post',
  ];
  const STEP_MS = 7000;
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('working');
  const id = link.split('/').pop() || '';

  // Advance the visible steps, holding on the last one until the report is really done.
  useEffect(() => {
    if (phase !== 'working') return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, [phase, steps.length]);

  // Ask the server every 3 seconds whether the report has finished.
  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    async function check() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/checkup/status?id=${id}`, { cache: 'no-store' });
        const { status } = (await res.json()) as { status: string };
        if (status === 'sent' || status === 'draft') {
          setPhase('ready');
          onReady?.();
          return;
        }
        if (status === 'failed') return setPhase('failed');
      } catch {
        // A dropped connection on a phone: keep trying.
      }
      if (Date.now() - started > 3 * 60 * 1000) return setPhase('slow');
      setTimeout(check, 3000);
    }
    const t = setTimeout(check, 3000);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const done = phase === 'ready';
  const pct = done ? 100 : Math.round(((step + 0.5) / steps.length) * 92);

  return (
    <div className="progress" aria-live="polite">
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol className="progress-steps">
        {steps.map((label, i) => {
          const state = done || i < step ? 'done' : i === step && phase === 'working' ? 'now' : 'todo';
          return (
            <li key={label} className={`step-${state}`}>
              <span className="step-mark" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
              {label}
            </li>
          );
        })}
      </ol>
      {done && (
        <a className="btn btn-accent" href={link} style={{ alignSelf: 'flex-start' }}>
          See your report
        </a>
      )}
      {phase === 'failed' && (
        <p className="form-msg err">
          We couldn&apos;t read @{handle}. Check the spelling, and make sure the account is a Business or Creator account
          (Instagram: Settings, then Account type and tools). Then try again.
        </p>
      )}
      {phase === 'slow' && (
        <p className="muted">
          This one is taking longer than usual. <a href={link}>Open the report page</a>, or watch for the email.
        </p>
      )}
    </div>
  );
}
