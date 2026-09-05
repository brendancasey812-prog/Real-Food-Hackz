import type { Metadata } from "next";
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
