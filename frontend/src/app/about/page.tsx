import Link from "next/link";
import { Scale, ArrowLeft, MapPin } from "lucide-react";

export const metadata = {
  title: "About CourtWatch JA — Free Jamaican Court Case Tracker",
  description:
    "CourtWatch JA makes Jamaican court information — Supreme Court judgments, Court of Appeal decisions, and Parish Court records — freely accessible to lawyers, journalists, students, and the public.",
  alternates: { canonical: "https://courtwatchjamaica.com/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.05] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#009B3A]" />
            <span className="text-sm font-bold">CourtWatch JA</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-20">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#009B3A]/20 bg-[#009B3A]/[0.07] text-[#009B3A] text-[11px] font-semibold uppercase tracking-wider">
          <MapPin className="h-3 w-3" />
          Jamaica
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
          About CourtWatch JA
        </h1>

        {/* Tagline */}
        <p className="text-xl sm:text-2xl font-medium text-[#FED100] mb-10">
          Free Jamaican court records — for everyone.
        </p>

        {/* Mission */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#009B3A] mb-4">
            Our Mission
          </h2>
          <p className="text-white/70 leading-relaxed text-base sm:text-lg">
            CourtWatch JA makes Jamaican court information — Supreme Court
            judgments, Court of Appeal decisions, and Parish Court records —
            accessible to everyone: lawyers, journalists, students, and the
            general public. Court data in Jamaica has historically been
            difficult to access and harder to search. We believe transparency
            in the Jamaican legal system matters, and that anyone with an
            internet connection should be able to know when their case is
            listed, read published judgments, and understand what is happening
            in Jamaica&apos;s courts.
          </p>
        </div>

        {/* What we do */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#009B3A] mb-4">
            What We Do
          </h2>
          <ul className="space-y-4 text-white/65 text-sm leading-relaxed">
            <li className="flex gap-3">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[#009B3A]/30 bg-[#009B3A]/10 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[#009B3A]" />
              </span>
              Automatically source and publish Jamaica Supreme Court and Court
              of Appeal judgments and court lists three times per week.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[#009B3A]/30 bg-[#009B3A]/10 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[#009B3A]" />
              </span>
              Send email notifications when a tracked Jamaican court case
              appears on a new court list or a related judgment is published.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[#009B3A]/30 bg-[#009B3A]/10 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[#009B3A]" />
              </span>
              Provide an interactive Judicial Constellation — a 3D map of
              Jamaica&apos;s judges and their case relationships across the
              legal system.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[#009B3A]/30 bg-[#009B3A]/10 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[#009B3A]" />
              </span>
              Aggregate Parish Court criminal case data so communities can stay
              informed about local legal proceedings across Jamaica&apos;s
              fourteen parishes.
            </li>
          </ul>
        </div>

        {/* Built by */}
        <div className="rounded-2xl border border-[#FED100]/10 bg-[#FED100]/[0.02] p-7">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#FED100] mb-4">
            Built by Jamaicans
          </h2>
          <p className="text-white/65 leading-relaxed text-sm">
            CourtWatch JA is a project built using modern technology a Rust
            backend, a Next.js frontend, and PostgreSQL for data storage. It is
            not affiliated with the Government of Jamaica or any court
            authority. Information is sourced from publicly available official
            court websites.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm mb-5">
            Ready to track your cases?
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#009B3A] hover:bg-[#00b344] text-white font-semibold rounded-2xl transition-colors"
          >
            Get Started — It&apos;s Free
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-4 text-xs text-white/30">
          <span>© 2026 CourtWatch JA. Made in Jamaica.</span>
          <Link
            href="/privacy"
            className="hover:text-white/55 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white/55 transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
