"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Scale, CheckCircle } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await apiClient.signup(email, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#009B3A]/60 focus:bg-black/50 transition-colors";

  if (success) {
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
              <CheckCircle className="h-7 w-7 text-[#009B3A]" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-sm text-white/50 mb-6">
            We sent a verification link to <span className="text-white/80">{email}</span>.
            Click it to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-[#009B3A] hover:text-[#009B3A]/80 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

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
            <Scale className="h-6 w-6 text-[#009B3A]" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Court<span className="text-[#009B3A]">Watch</span>
              <span className="text-[#FED100]"> JA</span>
            </h1>
            <p className="mt-1 text-sm text-white/40">Create your account</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                Password
              </label>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
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
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-white/35">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-[#009B3A] hover:text-[#009B3A]/80 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/20">
          Jamaica&apos;s premier legal case tracker
        </p>
      </div>
    </div>
  );
}
