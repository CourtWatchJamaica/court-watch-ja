"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Scale, Loader2 } from "lucide-react";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

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
      // Exchange the NextAuth OAuth session for a backend JWT
      fetch(`${BASE_URL}/auth/oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: (session as unknown as Record<string, unknown>).provider ?? "google",
          email: session.user.email,
          name: session.user.name ?? null,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            localStorage.setItem("token", data.token);
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
