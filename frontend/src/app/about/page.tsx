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
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#009B3A]" />
            <span className="text-sm font-semibold">CourtWatch JA</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] text-white/55 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Heading */}
        <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mb-3">
          About CourtWatch JA
        </h1>

        {/* Tagline */}
        <p className="text-lg sm:text-xl text-white/60 mb-14">
          Free Jamaican court records — for everyone.
        </p>

        {/* Mission */}
        <section className="border-t border-white/10 pt-8 mb-12">
          <h2 className="font-heading text-xl font-semibold mb-4">
            Our mission
          </h2>
          <p className="text-white/70 leading-relaxed text-base">
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
        </section>

        {/* What we do */}
        <section className="border-t border-white/10 pt-8 mb-12">
          <h2 className="font-heading text-xl font-semibold mb-4">
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
              Provide an interactive Judicial Constellation — a 3D map of
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
        <section className="border-t border-white/10 pt-8">
          <h2 className="font-heading text-xl font-semibold mb-4">
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
            className="inline-flex items-center px-5 py-2.5 bg-[#009B3A] hover:bg-[#00893a] text-white font-medium text-sm rounded-md transition-colors"
          >
            Get started — it&apos;s free
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
