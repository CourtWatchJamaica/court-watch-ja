"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import Dashboard from "@/components/Dashboard";
import GlassLanding from "@/components/landing/GlassLanding";
import { clearSessionHint, isLoggedIn } from "@/lib/session";

// ── Root Page — auth routing ──────────────────────────────────────────────────

type PageState = "loading" | "authed" | "guest";

export default function Home() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");

  useEffect(() => {
    if (!isLoggedIn()) {
      setPageState("guest");
      return;
    }
    apiClient
      .getMe()
      .then((user) => {
        if (user.email_verified === false) {
          router.replace("/check-email");
        } else {
          setPageState("authed");
        }
      })
      .catch(() => {
        clearSessionHint();
        setPageState("guest");
      });
  }, [router]);

  if (pageState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080810]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#009B3A]" />
      </div>
    );
  }

  if (pageState === "authed") {
    return <Dashboard />;
  }

  return <GlassLanding />;
}
