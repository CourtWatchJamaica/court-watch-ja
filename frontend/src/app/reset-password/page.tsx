"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Scale, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const inputCls =
    "w-full rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#009B3A]/70 transition-colors";

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
        </div>
        <h1 className="text-xl font-extrabold tracking-[-0.03em] text-white">Invalid reset link</h1>
        <p className="text-sm text-white/50">
          This password reset link is missing a token. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block w-full rounded-full glass-btn-green py-3 text-sm font-semibold text-center"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-[#009B3A]" />
          </div>
        </div>
        <h1 className="text-xl font-extrabold tracking-[-0.03em] text-white">Password reset!</h1>
        <p className="text-sm text-white/50">
          Your password has been updated. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.resetPassword(token, newPassword);
      setStatus("success");
      setTimeout(() => router.replace("/auth/login?reset=1"), 2000);
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError && err.status === 429) {
        setErrorMessage("Too many attempts. Please wait a minute and try again.");
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to reset password. The link may have expired."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-white/50 mb-1">Enter your new password below.</p>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-1.5">
          New Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className={inputCls + " pr-11"}
            placeholder="Min. 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/60 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/70 mb-1.5">
          Confirm New Password
        </label>
        <input
          type={showPassword ? "text" : "password"}
          className={inputCls}
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      {(errorMessage || status === "error") && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 space-y-2">
          <p>{errorMessage || "Something went wrong."}</p>
          {status === "error" && (
            <Link
              href="/forgot-password"
              className="font-medium text-[#009B3A] hover:underline"
            >
              Request a new reset link
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || status === "error"}
        className="w-full flex items-center justify-center gap-2 rounded-full glass-btn-green py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Resetting…
          </>
        ) : (
          "Reset Password"
        )}
      </button>

      <div className="text-center text-sm text-white/65">
        <Link
          href="/auth/login"
          className="font-medium text-[#009B3A] hover:text-[#009B3A]/80 transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080810] relative overflow-hidden px-4">
      <div className="dark" aria-hidden="true"><div className="glass-backdrop" /></div>
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{
          background:
            "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center justify-center">
            <Scale className="h-6 w-6 text-[#009B3A]" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-white">
              CourtWatch JA
            </h1>
            <p className="mt-1 text-sm text-white/70">Set a new password</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_30px_80px_rgba(0,0,0,0.5)] p-6 sm:p-7">
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#009B3A]" />
              </div>
            }
          >
            <ResetPasswordContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
