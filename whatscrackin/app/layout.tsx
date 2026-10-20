import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "What's Crackin' · Every local craft beer event, delivered weekly",
  description:
    'Trivia, tap takeovers, run clubs and release parties at every brewery and beer bar in town, in one weekly email.',
  openGraph: {
    title: "What's Crackin'",
    description: 'Every local craft beer event. Delivered weekly.',
    url: '/',
    siteName: "What's Crackin'",
    type: 'website',
  },
};

export const viewport: Viewport = { themeColor: '#f4f3ef', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Shrikhand&family=Unbounded:wght@400;500;600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
