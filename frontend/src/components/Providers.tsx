"use client";

import { ThemeProvider } from "next-themes";
import { CourtProvider } from "@/lib/court-context";
import { ChambersProvider } from "@/lib/chambers-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <CourtProvider>
        <ChambersProvider>{children}</ChambersProvider>
      </CourtProvider>
    </ThemeProvider>
  );
}
