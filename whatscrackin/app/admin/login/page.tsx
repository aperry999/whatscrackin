import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/chrome';
import { getAdmin } from '@/lib/auth';
import { sendLoginLink } from '../actions';

export const metadata: Metadata = { title: "Admin sign-in · What's Crackin'", robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (await getAdmin()) redirect('/admin');
  const { sent, error } = await searchParams;
  return (
    <main className="admin-auth">
      <div className="panel" style={{ width: '100%', maxWidth: 420 }}>
        <Wordmark />
        <h1 style={{ fontSize: 24 }}>Admin sign-in</h1>
        {sent ? (
          <p className="muted">If that email has admin access, a sign-in link is on its way. It expires in 20 minutes.</p>
        ) : (
          <form action={sendLoginLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error === 'expired' && <p className="form-msg err">That link expired or was already used. Get a new one below.</p>}
            {error === 'secret-missing' && (
              <p className="form-msg err">
                Sign-in isn&apos;t set up on this copy of the site: this deployment has no SESSION_SECRET value. Add it in Vercel for this
                environment, then redeploy.
              </p>
            )}
            {error === 'secret-short' && (
              <p className="form-msg err">
                This deployment&apos;s SESSION_SECRET is shorter than 32 characters. Set it to a longer random value in Vercel, then redeploy.
              </p>
            )}
            {error === 'session-failed' && (
              <p className="form-msg err">Sign-in failed while starting your session. Try a new link; if it happens again, check the Vercel logs.</p>
            )}
            {error === 'send' && <p className="form-msg err">The email didn&apos;t send. Check the SendGrid settings and try again.</p>}
            <label className="label">
              Email
              <input className="input" type="email" name="email" autoComplete="email" required />
            </label>
            <button className="btn btn-dark" type="submit">Email me a sign-in link</button>
          </form>
        )}
      </div>
    </main>
  );
}
