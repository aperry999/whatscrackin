'use client';

import { useState } from 'react';
import { Chevron } from './chrome';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'err'; text?: string };

async function post(url: string, body: Record<string, string>): Promise<Status> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return { kind: res.ok ? 'ok' : 'err', text: data.message || (res.ok ? 'Done.' : 'Something went wrong. Try again.') };
  } catch {
    return { kind: 'err', text: 'Could not reach the server. Check your connection and try again.' };
  }
}

function Msg({ s }: { s: Status }) {
  if (s.kind !== 'ok' && s.kind !== 'err') return null;
  return <p className={`form-msg ${s.kind}`} role="status">{s.text}</p>;
}

export type LiveCity = { slug: string; label: string };

export function HeroForm({ cities, initial }: { cities: LiveCity[]; initial: string }) {
  const [city, setCity] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const other = city === 'other';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setStatus({ kind: 'busy' });
    const email = String(f.get('email') || '');
    const hp = String(f.get('company') || '');
    const result = other
      ? await post('/api/request-city', { email, city: String(f.get('otherCity') || ''), company: hp })
      : await post('/api/subscribe', { email, city, company: hp });
    setStatus(result);
    if (result.kind === 'ok') form.reset();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-grid">
        <label className="label">
          City
          <span className="select-wrap">
            <select className="select" name="city" value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
              <option value="other">My city isn&apos;t listed</option>
            </select>
            <Chevron />
          </span>
        </label>
        {other && (
          <label className="label" style={{ color: 'var(--accent-ink)' }}>
            Your city
            <input className="input hl" name="otherCity" placeholder="City, state" autoComplete="address-level2" required maxLength={80} />
          </label>
        )}
        <label className="label">
          Email
          <input className="input" type="email" name="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} />
        </label>
      </div>
      <input className="hp" tabIndex={-1} aria-hidden="true" name="company" autoComplete="off" />
      <div className="form-actions">
        <button className="btn btn-accent" type="submit" disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? 'Sending…' : other ? 'Request my city' : 'Subscribe free'}
        </button>
        {status.kind === 'idle' || status.kind === 'busy' ? (
          <span className="muted" style={{ fontSize: 14 }}>
            {other ? "We'll email you the day your city launches." : 'Free. One email a week.'}
          </span>
        ) : (
          <Msg s={status} />
        )}
      </div>
    </form>
  );
}

export function CityRequestForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setStatus({ kind: 'busy' });
    const result = await post('/api/request-city', {
      email: String(f.get('email') || ''),
      city: String(f.get('city') || ''),
      company: String(f.get('company') || ''),
    });
    setStatus(result);
    if (result.kind === 'ok') form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="form-grid" style={{ alignItems: 'end' }}>
      <label className="label">
        Your city
        <input className="input" name="city" placeholder="City, state" autoComplete="address-level2" required maxLength={80} />
      </label>
      <label className="label">
        Email
        <input className="input" type="email" name="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} />
      </label>
      <input className="hp" tabIndex={-1} aria-hidden="true" name="company" autoComplete="off" />
      <button className="btn btn-accent" type="submit" style={{ gridColumn: '1 / -1' }} disabled={status.kind === 'busy'}>
        {status.kind === 'busy' ? 'Sending…' : 'Request my city'}
      </button>
      <div style={{ gridColumn: '1 / -1' }}><Msg s={status} /></div>
    </form>
  );
}

export function TripWaitlistForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setStatus({ kind: 'busy' });
    const result = await post('/api/trip-waitlist', {
      email: String(f.get('email') || ''),
      city: String(f.get('city') || ''),
      company: String(f.get('company') || ''),
    });
    setStatus(result);
    if (result.kind === 'ok') form.reset();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label className="label">
        Where are you headed? <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        <input className="input" name="city" placeholder="e.g. Asheville, NC" maxLength={80} />
      </label>
      <label className="label">
        Email
        <input className="input" type="email" name="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} />
      </label>
      <input className="hp" tabIndex={-1} aria-hidden="true" name="company" autoComplete="off" />
      <button className="btn btn-accent" type="submit" disabled={status.kind === 'busy'}>
        {status.kind === 'busy' ? 'Sending…' : 'Tell me when trips launch'}
      </button>
      <Msg s={status} />
    </form>
  );
}
