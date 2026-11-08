import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "About CourtWatch JA — Free Jamaican Court Case Tracker",
  description:
    "CourtWatch JA makes Jamaican court information — Supreme Court judgments, Court of Appeal decisions, and Parish Court records — freely accessible to lawyers, journalists, students, and the public.",
  alternates: { canonical: "https://courtwatchjamaica.com/about" },
};

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[#080810] text-white">
      <div className="dark" aria-hidden="true"><div className="glass-backdrop" /></div>
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 pt-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between rounded-full border border-white/10 bg-[#0e0e1a]/60 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_40px_rgba(0,0,0,0.35)] pl-5 pr-2 py-2">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#009B3A]" />
            <span className="text-sm font-semibold">CourtWatch JA</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-14">
        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-0.04em] leading-tight mb-3">
          About CourtWatch JA
        </h1>

        {/* Tagline */}
        <p className="text-lg sm:text-xl text-white/60 mb-14">
          Free Jamaican court records — for everyone.
        </p>

        {/* Mission */}
        <section className="rounded-[28px] border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold tracking-[-0.02em] mb-4">
            Our mission
          </h2>
          <p className="text-white/70 leading-relaxed text-base">
            CourtWatch JA makes Jamaican court information  Supreme Court
            judgments, Court of Appeal decisions, and Parish Court records
            accessible to everyone: lawyers, journalists, students, and the
            general public. Court data in Jamaica has historically been
            difficult to access and harder to search. We believe transparency
            in the Jamaican legal system matters, and that anyone with an
            internet connection should be able to know when their case is
            listed, read published judgments, and understand what is happening
            in Jamaica&apos;s courts.
          </p>
        </section>

        {/* What we do */}
        <section className="rounded-[28px] border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold tracking-[-0.02em] mb-4">
            What we do
          </h2>
          <ul className="space-y-3 text-white/70 text-[15px] leading-relaxed list-disc pl-5 marker:text-white/30">
            <li>
              Automatically source and publish Jamaica Supreme Court and Court
              of Appeal judgments and court lists three times per week.
            </li>
            <li>
              Send email notifications when a tracked Jamaican court case
              appears on a new court list or a related judgment is published.
            </li>
            <li>
              Provide an interactive Judicial Constellation  a 3D map of
              Jamaica&apos;s judges and their case relationships across the
              legal system.
            </li>
            <li>
              Aggregate Parish Court criminal case data so communities can stay
              informed about local legal proceedings across Jamaica&apos;s
              fourteen parishes.
            </li>
          </ul>
        </section>

        {/* Built by */}
        <section className="rounded-[28px] border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-6 sm:p-8">
          <h2 className="text-xl font-bold tracking-[-0.02em] mb-4">
            Built by Jamaicans
          </h2>
          <p className="text-white/70 leading-relaxed text-[15px]">
            CourtWatch JA is an independent project built with a Rust backend,
            a Next.js frontend, and PostgreSQL for data storage. It is not
            affiliated with the Government of Jamaica or any court authority.
            Information is sourced from publicly available official court
            websites.
          </p>
        </section>

        {/* CTA */}
        <div className="mt-14 border-t border-white/10 pt-10 text-center">
          <p className="text-white/60 text-sm mb-4">Ready to track your cases?</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center px-5 py-2.5 glass-btn-green font-semibold text-sm rounded-full"
          >
            Get started  it&apos;s free
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-4 text-[13px] text-white/55">
          <span>© 2026 CourtWatch JA. Made in Jamaica.</span>
          <Link href="/privacy" className="hover:text-white/85 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white/85 transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
