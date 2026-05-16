"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api";

type Status = "loading" | "success" | "error";

function VerifyPasswordChangeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No token found in the URL.");
      return;
    }

    apiClient
      .confirmPasswordChange(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message);
        setTimeout(() => {
          router.push("/profile?success=password_changed");
        }, 2500);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Failed to confirm password change.",
        );
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009B3A]/10 ring-1 ring-[#009B3A]/25">
            <ShieldCheck className="h-7 w-7 text-[#009B3A]" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Password Change
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CourtWatch JA
          </p>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#009B3A]" />
            <p className="text-sm text-muted-foreground">Verifying your request…</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/10 px-4 py-3 text-[13px] text-[#009B3A]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {message}
            </div>
            <p className="text-xs text-muted-foreground">
              Redirecting you to your profile…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {message}
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-xl bg-[#009B3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#009B3A]/85 transition-colors"
            >
              Back to Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPasswordChangePage() {
  return (
    <Suspense>
      <VerifyPasswordChangeInner />
    </Suspense>
  );
}
