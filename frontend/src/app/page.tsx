"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Scale,
  Calendar,
  Bell,
  ArrowUpRight,
  X,
  FileText,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Judgment, CourtSitting } from "@/lib/types";
import Dashboard from "@/components/Dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicPreview {
  judgments: Judgment[];
  sittings: CourtSitting[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-JM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Sign-Up Popup ─────────────────────────────────────────────────────────────

function SignUpPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="relative w-full max-w-sm rounded-lg border border-white/10 bg-[#0e0e1a] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <Scale className="h-6 w-6 text-[#009B3A] mb-4" />

        <h3 className="font-heading text-lg font-semibold text-white mb-1">
          Track your court cases for free
        </h3>
        <p className="text-sm text-white/55 mb-6 leading-relaxed">
          Sign up or log in to get notified when your case is listed, search
          judgments, and more.
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/auth/signup"
            className="flex items-center justify-center w-full py-2.5 bg-[#009B3A] text-white font-medium rounded-md hover:bg-[#00893a] transition-colors text-sm"
          >
            Sign up free
          </Link>
          <Link
            href="/auth/login"
            className="flex items-center justify-center w-full py-2.5 border border-white/15 text-white/80 font-medium rounded-md hover:border-white/30 hover:bg-white/5 transition-colors text-sm"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Judgment Preview Card ─────────────────────────────────────────────────────

function JudgmentPreviewCard({
  judgment,
  onViewAll,
}: {
  judgment: Judgment;
  onViewAll: () => void;
}) {
  return (
    <button
      onClick={onViewAll}
      className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:border-white/25 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          {judgment.court && (
            <span className="font-medium text-[#2ebd6b]">{judgment.court}</span>
          )}
          {judgment.date && (
            <span className="text-white/45">{formatDate(judgment.date)}</span>
          )}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
      </div>
      <p className="text-sm font-medium text-white/85 line-clamp-2 leading-snug mb-1.5">
        {judgment.title || judgment.case_number}
      </p>
      {judgment.summary_text && (
        <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
          {judgment.summary_text}
        </p>
      )}
    </button>
  );
}

// ── Sitting Preview Card ──────────────────────────────────────────────────────

function SittingPreviewCard({
  sitting,
  onViewAll,
}: {
  sitting: CourtSitting;
  onViewAll: () => void;
}) {
  return (
    <button
      onClick={onViewAll}
      className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:border-white/25 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          {sitting.event_date && (
            <span className="font-medium text-white/70">
              {formatDate(sitting.event_date)}
            </span>
          )}
          {sitting.event_type && (
            <span className="text-white/45">{sitting.event_type}</span>
          )}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
      </div>
      <p className="text-sm font-medium text-white/85 line-clamp-2 leading-snug mb-1">
        {sitting.title || sitting.case_number || "Untitled Sitting"}
      </p>
      {sitting.court_division && (
        <p className="text-xs text-white/50">{sitting.court_division}</p>
      )}
    </button>
  );
}

// ── Feature ───────────────────────────────────────────────────────────────────

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="border-t border-white/10 pt-5">
      <Icon className="h-5 w-5 text-[#2ebd6b] mb-3" />
      <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/55 leading-relaxed">{description}</p>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────

function LandingPage() {
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/public/preview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPreview(data as PublicPreview);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowPopup(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  const handleClosePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  const handleViewAll = useCallback(() => {
    setShowPopup(true);
  }, []);

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CourtWatch JA",
    url: "https://courtwatchjamaica.com",
    description:
      "Free Jamaican court case tracker. Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, track cases, and get notified.",
    foundingLocation: { "@type": "Country", name: "Jamaica" },
    areaServed: { "@type": "Country", name: "Jamaica" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <div className="min-h-screen bg-[#080810] text-white">
        {/* ── Landing Nav ── */}
        <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-[#080810]/95 backdrop-blur">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-2">
              <Scale className="h-4.5 w-4.5 text-[#009B3A]" />
              <span className="text-sm font-semibold text-white tracking-tight">
                CourtWatch JA
              </span>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/about"
                className="hidden sm:block text-[13px] text-white/60 hover:text-white px-3 py-1.5 transition-colors"
              >
                About
              </Link>
              <Link
                href="/auth/login"
                className="text-[13px] font-medium text-white/75 hover:text-white px-3 py-1.5 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="text-[13px] font-medium bg-[#009B3A] hover:bg-[#00893a] text-white px-3.5 py-1.5 rounded-md transition-colors"
              >
                Get started
              </Link>
            </nav>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="px-6 pt-36 pb-20 border-b border-white/10">
          <div className="max-w-5xl mx-auto">
            <p className="text-[13px] font-medium text-[#2ebd6b] mb-5">
              Jamaican court information, in one place
            </p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-[1.1] mb-6 max-w-3xl">
              Track Jamaican court cases as they happen.
            </h1>
            <p className="text-base sm:text-lg text-white/60 max-w-2xl mb-10 leading-relaxed">
              Search Supreme Court and Court of Appeal judgments, browse
              upcoming court lists, and get an email the moment your case is
              listed. Free to use.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-[#009B3A] hover:bg-[#00893a] text-white font-medium rounded-md transition-colors text-sm"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center px-5 py-2.5 border border-white/20 text-white font-medium rounded-md hover:border-white/40 hover:bg-white/5 transition-colors text-sm"
              >
                Sign in
              </Link>
            </div>

            <p className="text-xs text-white/40">
              Data sourced from the Supreme Court and Court of Appeal of
              Jamaica. Lists updated Monday, Wednesday, and Friday.
            </p>
          </div>
        </section>

        {/* ── Preview Section ── */}
        <section className="py-20 px-6 border-b border-white/10">
          <div className="max-w-5xl mx-auto">
            <div className="mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold mb-2">
                See what&apos;s inside
              </h2>
              <p className="text-white/55 text-sm sm:text-base">
                Live data from Jamaican courts — no account required to preview.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-10">
              {/* Judgments column */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-white/50" />
                    <span className="text-[13px] font-semibold text-white/85">
                      Recent judgments
                    </span>
                  </div>
                  <button
                    onClick={handleViewAll}
                    className="text-[13px] text-white/55 hover:text-white transition-colors"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {preview?.judgments && preview.judgments.length > 0
                    ? preview.judgments.map((j) => (
                        <JudgmentPreviewCard
                          key={j.id}
                          judgment={j}
                          onViewAll={handleViewAll}
                        />
                      ))
                    : [0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-24 rounded-lg border border-white/10 bg-white/[0.02] animate-pulse"
                        />
                      ))}
                </div>
              </div>

              {/* Sittings column */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/50" />
                    <span className="text-[13px] font-semibold text-white/85">
                      Upcoming sittings
                    </span>
                  </div>
                  <button
                    onClick={handleViewAll}
                    className="text-[13px] text-white/55 hover:text-white transition-colors"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {preview?.sittings && preview.sittings.length > 0
                    ? preview.sittings.map((s) => (
                        <SittingPreviewCard
                          key={s.id}
                          sitting={s}
                          onViewAll={handleViewAll}
                        />
                      ))
                    : [0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-24 rounded-lg border border-white/10 bg-white/[0.02] animate-pulse"
                        />
                      ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section className="py-20 px-6 border-b border-white/10">
          <div className="max-w-5xl mx-auto">
            <div className="mb-10 max-w-xl">
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold mb-2">
                Why CourtWatch JA?
              </h2>
              <p className="text-white/55 text-sm sm:text-base">
                Built for lawyers, journalists, students, and anyone navigating
                the Jamaican legal system.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              <Feature
                icon={Calendar}
                title="Supreme Court & Appeal lists"
                description="Court lists updated Monday, Wednesday, and Friday directly from official Jamaica Supreme Court and Court of Appeal sources."
              />
              <Feature
                icon={Bell}
                title="Track any Jamaican case"
                description="Enter your case number and get notified by email the moment it appears on a court list or a new judgment is filed."
              />
              <Feature
                icon={Users}
                title="Legal research & analytics"
                description="Browse Jamaica's judicial records, explore judges' sitting histories, and search Parish Court criminal case data by parish."
              />
            </div>
          </div>
        </section>

        {/* ── Mobile note ── */}
        <section className="py-16 px-6 border-b border-white/10">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-semibold mb-2">
                Coming to the App Store &amp; Google Play
              </h2>
              <p className="text-white/55 text-sm leading-relaxed max-w-lg">
                For now, the web app works great on mobile — add it to your home
                screen for an app-like experience.
              </p>
            </div>
            <Link
              href="/auth/signup"
              className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 border border-white/20 text-white font-medium rounded-md hover:border-white/40 hover:bg-white/5 transition-colors text-sm"
            >
              Use the web app
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-10 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-white/60">
              <Scale className="h-4 w-4" />
              <span className="text-[13px]">
                © 2026 CourtWatch JA. Made in Jamaica.
              </span>
            </div>
            <nav className="flex items-center gap-5 flex-wrap justify-center">
              {[
                { href: "/about", label: "About" },
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/terms", label: "Terms of Service" },
                {
                  href: "mailto:courtwatchjamaica@protonmail.com",
                  label: "Contact",
                },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-[13px] text-white/55 hover:text-white/85 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>

        {showPopup && <SignUpPopup onClose={handleClosePopup} />}
      </div>
    </>
  );
}

// ── Root Page — auth routing ──────────────────────────────────────────────────

type PageState = "loading" | "authed" | "guest";

export default function Home() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setPageState("guest");
      return;
    }
    apiClient
      .getMe()
      .then((user) => {
        if (user.email_verified === false) {
          router.replace("/check-email");
        } else {
          setPageState("authed");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        setPageState("guest");
      });
  }, [router]);

  if (pageState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080810]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#009B3A]" />
      </div>
    );
  }

  if (pageState === "authed") {
    return <Dashboard />;
  }

  return <LandingPage />;
}
