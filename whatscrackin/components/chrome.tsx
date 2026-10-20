import Link from 'next/link';

export function CrackLine({ width = 132 }: { width?: number }) {
  return (
    <svg width={width} height={Math.round(width / 10)} viewBox="0 0 360 34" aria-hidden="true">
      <polyline
        points="4,22 70,18 86,6 104,28 122,10 140,24 356,16"
        fill="none"
        stroke="#E8A33D"
        strokeWidth="7"
        strokeLinejoin="miter"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <Link href="/" className={large ? 'wordmark lg' : 'wordmark'} aria-label="What's Crackin' home">
      <span>What&apos;s Crackin&apos;</span>
      <CrackLine width={large ? 176 : 132} />
    </Link>
  );
}

export function SiteHeader({ current }: { current?: 'trips' }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand-row">
          <Wordmark />
          <span className="tagline">Fresh events. Poured weekly.</span>
        </div>
        <nav className="nav" aria-label="Main">
          <Link className="nav-link" href="/#week">This week</Link>
          <Link className="nav-link" href="/trips" aria-current={current === 'trips' ? 'page' : undefined}>Trips</Link>
          <Link className="nav-link" href="/#cities">Request a city</Link>
          <Link className="btn btn-dark sm" href="/#subscribe">Subscribe</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="brand">
          <Wordmark large />
          <span className="tagline-sm">Fresh events. Poured weekly.</span>
        </div>
        <nav aria-label="Footer">
          <Link href="/trips">Plan a trip</Link>
          <Link href="/#cities">Request a city</Link>
          <span>© {new Date().getFullYear()} What&apos;s Crackin&apos;</span>
        </nav>
      </div>
    </footer>
  );
}

export function Chevron() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
      <polyline points="2,5 7,10 12,5" fill="none" stroke="#5B606A" strokeWidth="1.6" />
    </svg>
  );
}
