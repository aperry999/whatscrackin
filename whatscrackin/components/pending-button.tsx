'use client';

import { useFormStatus } from 'react-dom';

// A submit button that disables itself and shows a working label while its form's action runs,
// so slow actions (like rebuilding a report, about a minute) don't look like nothing happened.
export function PendingButton({ label, pendingLabel, className = 'linkish' }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <span className="pending-label">
          <span className="pending-spin" aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
