"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { CourtProvider } from "@/lib/court-context";
import { ChambersProvider } from "@/lib/chambers-context";
import { TrackingProvider } from "@/lib/tracking-context";
import MaintenanceGate from "@/components/MaintenanceGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <CourtProvider>
          <ChambersProvider>
            <TrackingProvider>
              <MaintenanceGate>{children}</MaintenanceGate>
            </TrackingProvider>
          </ChambersProvider>
        </CourtProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
