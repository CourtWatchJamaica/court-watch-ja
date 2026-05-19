"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Scale, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token found in the URL.");
      return;
    }

    apiClient
      .verifyEmail(token)
      .then(({ token: jwt }) => {
        localStorage.setItem("token", jwt);
        // TODO: replace REPLACE_WITH_CONVERSION_LABEL with your Google Ads conversion label
        const w = window as Window & { gtag?: (...args: unknown[]) => void };
        w.gtag?.("event", "conversion", { send_to: "AW-18168669700/REPLACE_WITH_CONVERSION_LABEL" });
        setStatus("success");
        setTimeout(() => router.replace("/"), 1800);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Verification failed."
        );
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{
          background:
            "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
        }}
      />

      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
            {status === "loading" && (
              <Loader2 className="h-7 w-7 text-[#009B3A] animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-7 w-7 text-[#009B3A]" />
            )}
            {status === "error" && (
              <AlertTriangle className="h-7 w-7 text-amber-400" />
            )}
          </div>
        </div>

        {status === "loading" && (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Verifying your email…</h1>
            <p className="text-sm text-white/40">Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-xl font-bold text-white mb-2">
              Email verified!{" "}
              <span className="text-[#009B3A]">Welcome to CourtWatch JA.</span>
            </h1>
            <p className="text-sm text-white/40">Redirecting you to the dashboard…</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
            <p className="text-sm text-white/50 mb-6">{errorMessage}</p>
            <p className="text-sm text-white/40 mb-4">
              The link may have expired. Request a new one by signing up again with the same email.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block rounded-xl bg-[#009B3A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#009B3A]/85 transition-colors"
            >
              Resend verification email
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-[#009B3A]" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
