import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { CloudProvider } from "@/lib/cloud";
import { ThemeSync } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Real Food Hackz — Meal planning that tracks your kitchen",
  description:
    "Plan meals, track calories, manage your fridge & pantry, and auto-build your grocery list — all in sync."
};

/**
 * Let people zoom.
 *
 * Plenty of apps quietly forbid it to keep their layout pristine, which leaves
 * anyone who needs bigger text stuck with whatever size the designer picked —
 * and a receipt row or a price is exactly the thing you want to lean in on.
 * Pinch to five times, on a phone or a laptop trackpad.
 *
 * `viewportFit: "cover"` lets the page reach under a notch and a home bar,
 * which is what the `env(safe-area-inset-*)` padding on the tab bar is for.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

/**
 * Runs before the first paint so the saved theme is already on <html>: without
 * it a dark-mode user gets a white flash on every page load. The key is spelled
 * out rather than imported because `lib/theme` is a client module — keep it in
 * step with THEME_KEY there.
 */
const themeBootstrap = `(function(){try{var s=localStorage.getItem("rfh-theme");var t=s?JSON.parse(s).state.theme:"system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.add(d?"dark":"light");}catch(e){document.documentElement.classList.add("light");}})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full">
        <ThemeSync />
        <CloudProvider>
          <AppShell>{children}</AppShell>
        </CloudProvider>
      </body>
    </html>
  );
}
