import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin", "latin-ext"], variable: "--font-newsreader", style: ["normal", "italic"] });
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-instrument" });

export const metadata: Metadata = {
  title: "TIMEWISE: Explore history through evidence",
  description: "An interactive historical atlas where every event on the map leads back to its source.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Preload maplibre-gl CSS and basemap style for faster map initialization
// Note: maplibre-gl JS chunk uses dynamic hash, so we preload CSS and prefetch style instead
const preloadLinks = [
  { rel: "preload", as: "style", href: "https://cdn.jsdelivr.net/npm/maplibre-gl@5.0.0/dist/maplibre-gl.css" },
  { rel: "prefetch", as: "fetch", href: "https://tiles.openfreemap.org/styles/positron", crossOrigin: "anonymous" as const },
];

// Runs before paint so a saved dark preference doesn't flash light first.
const themeScript = `try{var t=localStorage.getItem('timewise-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

// Register service worker for caching tiles and data
const swScript = `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
        {preloadLinks.map((link, i) => (
          <link key={i} rel={link.rel} as={link.as} href={link.href} crossOrigin={link.crossOrigin} />
        ))}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
