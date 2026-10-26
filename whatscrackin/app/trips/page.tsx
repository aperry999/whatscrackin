import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/chrome';
import { TripWaitlistForm } from '@/components/forms';
import { ExplainerVideo } from '@/components/video';

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
              Tell us where and when, and you get your own interactive trip page with every brewery event within 10 miles during your
              stay. View it by day or by brewery, filter for live music, trivia or run clubs, and watch it fill in as breweries post.
            </p>
            <ExplainerVideo url={process.env.TRIP_VIDEO_URL} poster={process.env.TRIP_VIDEO_POSTER} />
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
              <h2>Your trip page fills in as your trip gets closer.</h2>
              <p className="muted" style={{ maxWidth: '28em' }}>
                Breweries post most events about two weeks out, so your page keeps updating, and we email you at every step so you never have to check.
              </p>
            </div>
            <ol className="timeline">
              <li><span className="t">Booking day</span><b>Pick your breweries</b><span>Within the hour your trip page lists every brewery and beer bar within 10 miles. Keep, star or skip each one.</span></li>
              <li><span className="t">14 days out</span><b>Your trip page goes live</b><span>We read your breweries&apos; posts every night and add new events to your page as they&apos;re announced.</span></li>
              <li><span className="t">7 days out</span><b>First look</b><span>One-time events like releases, takeovers and live music that only happen while you&apos;re in town.</span></li>
              <li><span className="t">2 days out</span><b>Your schedule is set</b><span>Every day of your trip on one page, sorted your way, with starred breweries on top.</span></li>
              <li><span className="t">Each trip day</span><b>Today&apos;s events, every morning</b><span>A morning email with the day&apos;s lineup and a link back to your trip page. One tap pauses the dailies if you&apos;d rather wing it.</span></li>
              <li><span className="t">After</span><b>Trip wrap-up</b><span>A quick recap, plus a way to get What&apos;s Crackin&apos; in your home city.</span></li>
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
