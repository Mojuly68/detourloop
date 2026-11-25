import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';

// One family for everything: Roboto. --font-serif is kept as the "display" variable name.
const serif = Roboto({ subsets: ['latin'], weight: ['700', '900'], style: ['normal', 'italic'], variable: '--font-serif' });
const sans = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'DetourLoop — Explore beyond the obvious.',
  description: 'DetourLoop finds the places worth stopping for along your route, then turns your trip into a story you can replay and share.',
};

export const viewport: Viewport = { themeColor: '#183C50' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
