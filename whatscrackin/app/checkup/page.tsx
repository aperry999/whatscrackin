import type { Metadata } from 'next';
import { CheckupForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'Free Instagram checkup for breweries · Crackem',
  description: "A free report on your brewery's Instagram: what's working, what isn't, and three things to try this month.",
  robots: { index: false },
};

export default function CheckupPage() {
  return (
    <main className="checkup">
      <section className="wrap checkup-hero">
        <div className="copy">
          <span className="eyebrow">Crackem · For breweries</span>
          <h1>How&apos;s your brewery&apos;s Instagram pulling?</h1>
          <p className="muted checkup-lede">
            Tell us where to find you and we&apos;ll email a free report on your Instagram: what&apos;s working, what isn&apos;t, and three
            things to try this month. Written for whoever runs your account between shifts, not for marketing pros.
          </p>
          <ul className="checkup-gets">
            <li><b>Your numbers in plain words.</b> How often you post, which posts land, and how you compare to breweries your size.</li>
            <li><b>Three things to do this month.</b> Small tasks that fit a slow shift, with captions written for your upcoming events.</li>
            <li><b>A sample event ad.</b> Built from your own best post, so you can see what promotion could look like.</li>
          </ul>
        </div>
        <div className="panel">
          <span className="eyebrow">Takes about 30 seconds</span>
          <CheckupForm />
        </div>
      </section>
      <p className="wrap checkup-foot muted">Crackem. We only read public Instagram data for the free report.</p>
    </main>
  );
}
