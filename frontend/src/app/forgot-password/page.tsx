"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, Loader2, CheckCircle, Mail } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiClient.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many requests. Please wait a minute before trying again.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#009B3A]/60 focus:bg-black/50 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{
          background:
            "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
        }}
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
            {submitted ? (
              <CheckCircle className="h-6 w-6 text-[#009B3A]" />
            ) : (
              <Scale className="h-6 w-6 text-[#009B3A]" />
            )}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Court<span className="text-[#009B3A]">Watch</span>
              <span className="text-[#FED100]"> JA</span>
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {submitted ? "Check your inbox" : "Reset your password"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-6">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Mail className="h-10 w-10 text-[#009B3A]/70" />
              </div>
              <p className="text-sm text-white/70">
                If an account exists for{" "}
                <span className="font-medium text-white">{email}</span>, you will
                receive a password reset link within a few minutes.
              </p>
              <p className="text-xs text-white/35">
                The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
              </p>
              <Link
                href="/auth/login"
                className="mt-2 inline-block w-full rounded-xl bg-[#009B3A]/15 border border-[#009B3A]/30 py-3 text-sm font-semibold text-[#009B3A] hover:bg-[#009B3A]/25 transition-colors text-center"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-white/50 mb-1">
                Enter the email address for your account and we&apos;ll send you a
                reset link.
              </p>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#009B3A] py-3 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <div className="text-center text-sm text-white/35">
                <Link
                  href="/auth/login"
                  className="font-medium text-[#009B3A] hover:text-[#009B3A]/80 transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
