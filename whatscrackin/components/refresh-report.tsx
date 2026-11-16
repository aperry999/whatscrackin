'use client';

import { useState } from 'react';

// Shown at the end of a report once its free refresh window has opened.
export function RefreshReport({ reportId }: { reportId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function refresh() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/checkup/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportId }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; reportLink?: string };
      if (data.reportLink) {
        window.location.href = data.reportLink;
        return;
      }
      setMsg(data.message || 'Something went wrong. Try again.');
    } catch {
      setMsg('Could not reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" className="btn btn-accent" onClick={refresh} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Starting…' : 'Get an updated report'}
      </button>
      {msg && <p className="form-msg err">{msg}</p>}
    </div>
  );
}
