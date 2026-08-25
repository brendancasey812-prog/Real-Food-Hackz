import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { CloudProvider } from "@/lib/cloud";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Real Food Hackz — Meal planning that tracks your kitchen",
  description:
    "Plan meals, track calories, manage your fridge & pantry, and auto-build your grocery list — all in sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <CloudProvider>
          <AppShell>{children}</AppShell>
        </CloudProvider>
      </body>
    </html>
  );
}
