import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";
import ChambersPanel from "@/components/ChambersPanel";
import MaintenanceGate from "@/components/MaintenanceGate";

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
  icons: {
    icon: [{ url: "/icons/higher-court.svg", type: "image/svg+xml" }],
    shortcut: ["/icons/higher-court.svg"],
    apple: [{ url: "/icons/higher-court.svg" }],
  },
  openGraph: {
    title: "CourtWatch JA — Jamaican Legal Case Tracker",
    description:
      "Track Jamaican court judgments, monitor cases, and stay informed on the latest legal decisions from Jamaica's Supreme Court, Court of Appeal, and Parish Courts.",
    siteName: "CourtWatch JA",
    locale: "en_JM",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CourtWatch JA — Jamaican Legal Case Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CourtWatch JA — Jamaican Legal Case Tracker",
    description:
      "Track Jamaican court judgments, monitor cases, and stay informed on the latest legal decisions.",
    images: ["/og-image.png"],
  },
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
          <MaintenanceGate>
            {children}
            <ScrollToTop />
            <ChambersPanel />
          </MaintenanceGate>
        </Providers>
      </body>
    </html>
  );
}
