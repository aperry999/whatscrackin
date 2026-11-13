'use client';

import { useState } from 'react';
import { Chevron } from './chrome';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'err'; text?: string; previewLink?: string };

async function post(url: string, body: Record<string, string>): Promise<Status> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; previewLink?: string };
    return { kind: res.ok ? 'ok' : 'err', text: data.message || (res.ok ? 'Done.' : 'Something went wrong. Try again.'), previewLink: data.previewLink };
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

const CHECKUP_ROLES = ['Owner', 'Taproom manager', 'Bartender or staff', 'Marketing person or agency', 'Nobody really'];

export function CheckupForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setStatus({ kind: 'busy' });
    const get = (k: string) => String(f.get(k) || '');
    const result = await post('/api/checkup', {
      brewery: get('brewery'),
      city: get('city'),
      handle: get('handle'),
      name: get('name'),
      email: get('email'),
      role: get('role'),
      consent: f.get('consent') ? 'yes' : '',
      company: get('company'),
    });
    setStatus(result);
    if (result.kind === 'ok') form.reset();
  }

  if (status.kind === 'ok') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>You&apos;re on the list.</h2>
        <p className="muted">{status.text}</p>
        {status.previewLink && (
          <p className="report-banner">
            Preview only: <a href={status.previewLink}>open the draft report</a>. It takes about a minute to fill in, so refresh if it&apos;s still building.
          </p>
        )}
        <button className="btn btn-ghost sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setStatus({ kind: 'idle' })}>
          Add another brewery
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-grid">
        <label className="label">
          Brewery name
          <input className="input" name="brewery" autoComplete="organization" required maxLength={120} />
        </label>
        <label className="label">
          City
          <input className="input" name="city" placeholder="Orlando, FL" autoComplete="address-level2" required maxLength={80} />
        </label>
      </div>
      <label className="label">
        Instagram handle
        <input className="input" name="handle" placeholder="@yourbrewery" autoCapitalize="off" autoCorrect="off" spellCheck={false} required maxLength={80} />
        <span className="checkup-hint">Needs to be a Business or Creator account. Not sure? We&apos;ll check for you.</span>
      </label>
      <div className="form-grid">
        <label className="label">
          Your name
          <input className="input" name="name" autoComplete="name" required maxLength={80} />
        </label>
        <label className="label">
          Email
          <input className="input" type="email" name="email" placeholder="you@yourbrewery.com" autoComplete="email" required maxLength={254} />
        </label>
      </div>
      <fieldset className="checkup-roles">
        <legend className="label">Who posts on your Instagram?</legend>
        <div className="checkup-chips">
          {CHECKUP_ROLES.map((r) => (
            <label key={r} className="checkup-chip">
              <input type="radio" name="role" value={r} />
              <span>{r}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="checkup-consent">
        <input type="checkbox" name="consent" required />
        <span>Crackem can email me my report and a few follow-up tips. I can unsubscribe anytime.</span>
      </label>
      <input className="hp" tabIndex={-1} aria-hidden="true" name="company" autoComplete="off" />
      <button className="btn btn-accent" type="submit" disabled={status.kind === 'busy'}>
        {status.kind === 'busy' ? 'Sending…' : 'Get my free report'}
      </button>
      <Msg s={status} />
    </form>
  );
}
