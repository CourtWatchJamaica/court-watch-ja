"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { apiClient } from "@/lib/api";
import { Scale, CheckCircle } from "lucide-react";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
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
      await apiClient.signup(email, password, displayName.trim() || undefined);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-md border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#009B3A]/70 transition-colors";

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080810] px-4">
        <div
          className="fixed top-0 left-0 right-0 h-[3px] z-50"
          style={{
            background:
              "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
          }}
        />
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <CheckCircle className="h-8 w-8 text-[#009B3A]" />
          </div>
          <h1 className="font-heading text-xl font-semibold text-white mb-2">Check your inbox</h1>
          <p className="text-sm text-white/50 mb-6">
            We sent a verification link to{" "}
            <span className="text-white/80">{email}</span>.
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
    <div className="min-h-screen flex items-center justify-center bg-[#080810] px-4">
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{
          background:
            "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
        }}
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Scale className="h-7 w-7 text-[#009B3A]" />
          <div className="text-center">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-white">
              CourtWatch JA
            </h1>
            <p className="mt-1 text-sm text-white/60">Create your account</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0e0e1a] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">
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
              <label className="block text-xs font-medium text-white/70 mb-1.5">
                Display Name <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Ramone"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">
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
              <label className="block text-xs font-medium text-white/70 mb-1.5">
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
              <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-[#009B3A] py-2.5 text-sm font-medium text-white hover:bg-[#009B3A]/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          {/* Google OAuth — only rendered when credentials are configured */}
          {googleEnabled && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#0e0e1a] px-3 text-[11px] text-white/55">
                    or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  signIn("google", { callbackUrl: "/auth/oauth-callback" })
                }
                className="flex w-full items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] py-2.5 text-sm font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <div className="mt-5 text-center text-sm text-white/65">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-[#009B3A] hover:text-[#009B3A]/80 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/50">
          Free access to Jamaican court records
        </p>
      </div>
    </div>
  );
}
