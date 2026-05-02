import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "CourtWatch JA — Jamaican Legal Case Tracker",
  description:
    "Track Jamaican court judgments, monitor cases, and stay informed on the latest legal decisions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <ScrollToTop />
        </Providers>
      </body>
    </html>
  );
}
