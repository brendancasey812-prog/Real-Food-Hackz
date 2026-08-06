import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PantryPlan — Meal planning that tracks your kitchen",
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
