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
  metadataBase: new URL("https://courtwatchjamaica.com"),
  title: "CourtWatch JA — Free Jamaican Court Case Tracker",
  description:
    "Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, track cases, and get notified. Free access to Jamaican court records.",
  keywords:
    "Jamaica court, Supreme Court, Court of Appeal, judgment, case tracker, Parish Court, legal research, Jamaican law",
  icons: {
    icon: [{ url: "/icons/higher-court.svg", type: "image/svg+xml" }],
    shortcut: ["/icons/higher-court.svg"],
    apple: [{ url: "/icons/higher-court.svg" }],
  },
  openGraph: {
    title: "CourtWatch JA — Free Jamaican Court Case Tracker",
    description:
      "Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, track cases, and get notified. Free access to Jamaican court records.",
    siteName: "CourtWatch JA",
    locale: "en_JM",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CourtWatch JA — Free Jamaican Court Case Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CourtWatch JA — Free Jamaican Court Case Tracker",
    description:
      "Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, track cases, and get notified. Free access to Jamaican court records.",
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
