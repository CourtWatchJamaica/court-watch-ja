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
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center space-y-5">
        <div className="flex justify-center">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>

        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Password Change
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CourtWatch JA
          </p>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your request…</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-[13px] text-primary">
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
            <div className="flex items-center gap-2.5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {message}
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Back to profile
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
