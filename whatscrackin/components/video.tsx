'use client';

import { useState } from 'react';

// Turns a YouTube, Vimeo or direct video link into something playable.
function source(url: string): { kind: 'iframe' | 'file'; src: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&playsinline=1&rel=0` };
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0` };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}?autoplay=1` };
    }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: 'file', src: url };
  } catch {
    /* fall through */
  }
  return null;
}

// Vertical (9:16) explainer. Shows a still frame with a play button; loads the player only when tapped.
// With no video set yet, the frame shows as a "coming soon" placeholder.
export function ExplainerVideo({ url, poster, dark = false }: { url?: string; poster?: string; dark?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const src = url ? source(url) : null;

  return (
    <figure className={dark ? 'explainer dark' : 'explainer'}>
      <div className="explainer-frame">
        {playing && src ? (
          src.kind === 'iframe' ? (
            <iframe src={src.src} title="How custom trip event lists work" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <video src={src.src} controls autoPlay playsInline />
          )
        ) : (
          <>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="explainer-poster" />
            ) : (
              <div className="explainer-still" aria-hidden="true">
                <span className="explainer-mark">What&apos;s Crackin&apos;</span>
                <svg width="120" height="12" viewBox="0 0 360 34"><polyline points="4,22 70,18 86,6 104,28 122,10 140,24 356,16" fill="none" stroke="#E8A33D" strokeWidth="7" strokeLinejoin="miter" strokeLinecap="round" /></svg>
                <span className="explainer-title">Your trip page, in 60 seconds</span>
              </div>
            )}
            <button
              type="button"
              className="explainer-play"
              onClick={() => setPlaying(true)}
              disabled={!src}
              aria-label={src ? 'Play the trip list explainer video' : 'Explainer video coming soon'}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><polygon points="9,5 24,14 9,23" fill="#1A1206" /></svg>
            </button>
            {!src && <span className="explainer-soon">Video coming soon</span>}
          </>
        )}
      </div>
      <figcaption>See how a trip page works</figcaption>
    </figure>
  );
}
