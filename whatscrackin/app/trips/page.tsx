import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/chrome';
import { TripWaitlistForm } from '@/components/forms';

export const metadata: Metadata = {
  title: "Custom trip event lists · What's Crackin'",
  description: 'Every brewery event in the city you are visiting, on the dates you are there.',
};

export default function TripsPage() {
  return (
    <>
      <SiteHeader current="trips" />
      <main>
        <section className="wrap trip-hero">
          <div className="copy">
            <span className="eyebrow">Custom trip event lists · any city</span>
            <h1>Your brewery trip, planned around your dates.</h1>
            <p className="muted" style={{ fontSize: 19, maxWidth: '32em' }}>
              Tell us where and when. We find every brewery and beer bar within 10 miles, you pick the ones you want, and we email you
              what&apos;s happening at them while you&apos;re there.
            </p>
          </div>
          <div className="panel">
            <span className="eyebrow">Launching soon</span>
            <h2>Be first in line</h2>
            <p className="muted">
              Trip lists are almost ready. Leave your email and we&apos;ll let you know the day you can book one.
            </p>
            <TripWaitlistForm />
          </div>
        </section>

        <section className="section-band">
          <div className="wrap section two-col">
            <div className="section-head">
              <span className="eyebrow">How it works</span>
              <h2>An email at every step, from booking to last call.</h2>
              <p className="muted" style={{ maxWidth: '28em' }}>
                Breweries post most events about two weeks out, so your list keeps filling in as your trip gets closer.
              </p>
            </div>
            <ol className="timeline">
              <li><span className="t">Booking day</span><b>Pick your breweries</b><span>Within the hour you get every brewery and beer bar within 10 miles. Keep, star or skip each one.</span></li>
              <li><span className="t">14 days out</span><b>Your trip page goes live</b><span>We start reading your breweries&apos; posts every night and add what we find.</span></li>
              <li><span className="t">7 days out</span><b>First look</b><span>One-time events like releases, takeovers and live music that only happen while you&apos;re in town.</span></li>
              <li><span className="t">2 days out</span><b>Final list</b><span>Your full schedule, day by day, with starred breweries on top.</span></li>
              <li><span className="t">Each trip day</span><b>Today&apos;s events, every morning</b><span>Sent in your trip&apos;s local time. One tap pauses the dailies if you&apos;d rather wing it.</span></li>
              <li><span className="t">After</span><b>Trip wrap-up</b><span>A quick recap, plus a way to get What&apos;s Crackin&apos; in your home city.</span></li>
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
