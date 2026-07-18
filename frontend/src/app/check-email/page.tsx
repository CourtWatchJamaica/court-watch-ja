"use client";

import Link from "next/link";
import { Scale, Mail } from "lucide-react";

export default function CheckEmailPage() {
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
          <div className="flex items-center justify-center">
            <Mail className="h-7 w-7 text-[#009B3A]" />
          </div>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-[#009B3A]" />
            <span className="text-sm font-semibold text-white/60">
              CourtWatch JA
            </span>
          </div>
        </div>

        <h1 className="font-heading text-xl font-semibold text-white mb-3">Verify your email to continue</h1>
        <p className="text-sm text-white/50 mb-8">
          Check your inbox for the verification link we sent when you signed up.
          Once verified, you can sign in and access your account.
        </p>

        <Link
          href="/auth/signup"
          className="inline-block rounded-md bg-[#009B3A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#009B3A]/85 transition-colors mb-4"
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
