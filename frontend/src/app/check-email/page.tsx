"use client";

import Link from "next/link";
import { Scale, Mail } from "lucide-react";

export default function CheckEmailPage() {
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
            <Mail className="h-7 w-7 text-[#009B3A]" />
          </div>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-[#009B3A]" />
            <span className="text-sm font-semibold text-white/60">
              Court<span className="text-[#009B3A]">Watch</span>
              <span className="text-[#FED100]"> JA</span>
            </span>
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-3">Verify your email to continue</h1>
        <p className="text-sm text-white/50 mb-8">
          Check your inbox for the verification link we sent when you signed up.
          Once verified, you can sign in and access your account.
        </p>

        <Link
          href="/auth/signup"
          className="inline-block rounded-xl bg-[#009B3A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#009B3A]/85 transition-colors mb-4"
        >
          Resend verification email
        </Link>

        <div className="mt-4">
          <Link
            href="/auth/login"
            className="text-sm text-white/65 hover:text-white/80 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
