"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Scale, Loader2 } from "lucide-react";

export default function OAuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }

    if (status === "authenticated" && session?.user?.email) {
      // Exchange the NextAuth session for a backend JWT via our own server
      // route — the server reads the session cookie and calls the backend
      // with a shared secret, so the browser never supplies the email.
      fetch("/api/oauth-exchange", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            localStorage.setItem("token", data.token);
            // TODO: replace REPLACE_WITH_CONVERSION_LABEL with your Google Ads conversion label
            // Note: fires for all OAuth sign-ins; add isNewUser from backend to restrict to new accounts only
            const w = window as Window & { gtag?: (...args: unknown[]) => void };
            w.gtag?.("event", "conversion", { send_to: "AW-18168669700/REPLACE_WITH_CONVERSION_LABEL" });
            window.location.href = "/";
          } else {
            router.replace("/auth/login?error=oauth");
          }
        })
        .catch(() => router.replace("/auth/login?error=oauth"));
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-4 text-white/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
          <Scale className="h-6 w-6 text-[#009B3A]" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#009B3A]" />
          <span className="text-sm">Completing sign-in…</span>
        </div>
      </div>
    </div>
  );
}
