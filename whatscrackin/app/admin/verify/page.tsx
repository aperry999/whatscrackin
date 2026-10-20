import type { Metadata } from 'next';
import { Wordmark } from '@/components/chrome';
import { signIn } from '../actions';

export const metadata: Metadata = { title: "Admin sign-in · What's Crackin'", robots: { index: false } };
export const dynamic = 'force-dynamic';

// The email link lands here and the click on the button signs in. Doing it on a button press
// stops email security scanners, which open links automatically, from using up the link.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return (
    <main className="admin-auth">
      <form action={signIn} className="panel" style={{ width: '100%', maxWidth: 420 }}>
        <Wordmark />
        <h1 style={{ fontSize: 24 }}>Finish signing in</h1>
        <input type="hidden" name="token" value={token} />
        <button className="btn btn-dark" type="submit">Sign in to admin</button>
      </form>
    </main>
  );
}
