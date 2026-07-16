"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Scale,
  Calendar,
  Bell,
  TrendingUp,
  ArrowUpRight,
  X,
  FileText,
  Users,
  ChevronRight,
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

// ── Particle data (deterministic "random" positions / timings) ────────────────

const PARTICLES: { x: number; s: number; d: number; dl: number }[] = [
  { x: 4, s: 2, d: 14, dl: 0 },
  { x: 10, s: 3, d: 18, dl: 2.5 },
  { x: 17, s: 2, d: 12, dl: 5 },
  { x: 22, s: 3, d: 20, dl: 1 },
  { x: 30, s: 2, d: 16, dl: 7.2 },
  { x: 37, s: 4, d: 22, dl: 3.5 },
  { x: 43, s: 2, d: 11, dl: 9 },
  { x: 51, s: 3, d: 19, dl: 0.5 },
  { x: 58, s: 2, d: 15, dl: 6.1 },
  { x: 64, s: 3, d: 17, dl: 4 },
  { x: 70, s: 2, d: 13, dl: 8.3 },
  { x: 76, s: 3, d: 21, dl: 2 },
  { x: 82, s: 2, d: 16, dl: 6.6 },
  { x: 88, s: 4, d: 14, dl: 1.5 },
  { x: 93, s: 2, d: 18, dl: 4.5 },
  { x: 97, s: 3, d: 20, dl: 3 },
  { x: 14, s: 2, d: 24, dl: 10.5 },
  { x: 46, s: 3, d: 26, dl: 7.8 },
  { x: 7, s: 2, d: 17, dl: 11 },
  { x: 55, s: 2, d: 23, dl: 0.8 },
];

// ── Scroll fade-in hook ───────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function ScrollFadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease-out ${delay}ms, transform 0.65s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Sign-Up Popup ─────────────────────────────────────────────────────────────

function SignUpPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d0d1a]/95 backdrop-blur-xl p-6 shadow-2xl shadow-black/60">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white/70 hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#009B3A]/15 ring-1 ring-[#009B3A]/20">
          <Scale className="h-6 w-6 text-[#009B3A]" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          Track your court cases for free
        </h3>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Sign up or log in to get notified when your case is listed, search
          judgments, and more.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/auth/signup"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#009B3A] text-white font-semibold rounded-xl hover:bg-[#00b344] transition-colors text-sm"
          >
            Sign Up Free
          </Link>
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full py-3 border border-white/15 text-white/80 font-medium rounded-xl hover:border-white/30 hover:bg-white/5 transition-colors text-sm"
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Floating Particles ────────────────────────────────────────────────────────

function Particles() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute bottom-0 rounded-full bg-[#FED100]"
          style={{
            left: `${p.x}%`,
            width: `${p.s}px`,
            height: `${p.s}px`,
            opacity: 0,
            animation: `particleRise ${p.d}s ease-in -${p.dl}s infinite`,
          }}
        />
      ))}
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
      className="w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-4 hover:border-[#009B3A]/25 hover:bg-[#009B3A]/[0.04] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {judgment.court && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#009B3A]/10 text-[#009B3A] border border-[#009B3A]/15">
              {judgment.court}
            </span>
          )}
          {judgment.date && (
            <span className="text-[10px] text-white/65">
              {formatDate(judgment.date)}
            </span>
          )}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/50 group-hover:text-[#009B3A]/60 transition-colors shrink-0" />
      </div>
      <p className="text-sm font-medium text-white/80 line-clamp-2 leading-snug mb-2">
        {judgment.title || judgment.case_number}
      </p>
      {judgment.summary_text && (
        <p className="text-xs text-white/65 line-clamp-2 leading-relaxed">
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
      className="w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-4 hover:border-[#FED100]/20 hover:bg-[#FED100]/[0.03] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {sitting.event_date && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FED100]/10 text-[#FED100] border border-[#FED100]/15">
              {formatDate(sitting.event_date)}
            </span>
          )}
          {sitting.event_type && (
            <span className="text-[10px] text-white/65">
              {sitting.event_type}
            </span>
          )}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/50 group-hover:text-[#FED100]/60 transition-colors shrink-0" />
      </div>
      <p className="text-sm font-medium text-white/80 line-clamp-2 leading-snug mb-1">
        {sitting.title || sitting.case_number || "Untitled Sitting"}
      </p>
      {sitting.court_division && (
        <p className="text-xs text-white/65">{sitting.court_division}</p>
      )}
    </button>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  description,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: "green" | "gold" | "purple";
}) {
  const colors = {
    green: {
      border: "border-l-[#009B3A]/40",
      bg: "bg-[#009B3A]/10",
      icon: "text-[#009B3A]",
    },
    gold: {
      border: "border-l-[#FED100]/40",
      bg: "bg-[#FED100]/10",
      icon: "text-[#FED100]",
    },
    purple: {
      border: "border-l-purple-500/40",
      bg: "bg-purple-500/10",
      icon: "text-purple-400",
    },
  }[accent];

  return (
    <div
      className={`rounded-2xl border border-white/[0.07] border-l-2 ${colors.border} bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors`}
    >
      <div
        className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${colors.bg}`}
      >
        <Icon className={`h-5 w-5 ${colors.icon}`} />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{description}</p>
    </div>
  );
}

// ── Phone Mockup ──────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[172px] h-[344px] rounded-[38px] border-[3px] border-white/[0.13] bg-[#080810] shadow-2xl shadow-black/80 overflow-hidden flex flex-col items-center select-none ring-1 ring-inset ring-white/[0.05]">
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

      {/* Dynamic island pill */}
      <div className="mt-[14px] w-[58px] h-[19px] rounded-full bg-black z-10 flex items-center justify-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#1a1a2e]/70" />
      </div>

      {/* Screen */}
      <div className="flex-1 w-full px-3 py-3 flex flex-col gap-2 overflow-hidden">
        {/* App header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-md bg-[#009B3A]/25 ring-1 ring-[#009B3A]/20">
              <Scale className="h-2.5 w-2.5 text-[#009B3A]" />
            </div>
            <p className="text-[6.5px] font-bold text-white/55 tracking-widest uppercase">
              CourtWatch JA
            </p>
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-[#009B3A]/60" />
        </div>

        {/* Skeleton content rows */}
        <div className="space-y-1 mt-0.5">
          <div className="h-[5px] w-full rounded-full bg-white/[0.07]" />
          <div className="h-[5px] w-3/4 rounded-full bg-white/[0.05]" />
        </div>

        {/* Case notification card */}
        <div className="w-full rounded-xl bg-[#009B3A]/[0.12] border border-[#009B3A]/20 p-2 mt-0.5">
          <div className="flex items-center gap-1 mb-1">
            <Bell className="h-2 w-2 text-[#009B3A]" />
            <p className="text-[6px] text-[#009B3A] font-bold uppercase tracking-wide">
              Case Listed
            </p>
          </div>
          <p className="text-[6px] text-white/50 leading-snug">
            Your case appears on Monday&apos;s court list
          </p>
        </div>

        {/* Judgment notification card */}
        <div className="w-full rounded-xl bg-[#FED100]/[0.08] border border-[#FED100]/15 p-2">
          <div className="flex items-center gap-1 mb-1">
            <FileText className="h-2 w-2 text-[#FED100]" />
            <p className="text-[6px] text-[#FED100] font-bold uppercase tracking-wide">
              New Judgment
            </p>
          </div>
          <p className="text-[6px] text-white/50 leading-snug">
            Smith v. Attorney General — filed today
          </p>
        </div>

        {/* Small skeleton rows */}
        <div className="space-y-1 mt-0.5">
          <div className="h-[4px] w-full rounded-full bg-white/[0.05]" />
          <div className="h-[4px] w-2/3 rounded-full bg-white/[0.04]" />
          <div className="h-[4px] w-4/5 rounded-full bg-white/[0.03]" />
        </div>

        {/* CTA bar */}
        <div className="mt-auto w-full h-8 rounded-xl bg-[#009B3A]/15 border border-[#009B3A]/20 flex items-center justify-center gap-1">
          <p className="text-[6.5px] text-[#009B3A]/80 font-semibold">
            Track a Case
          </p>
          <ChevronRight className="h-2 w-2 text-[#009B3A]/60" />
        </div>
      </div>

      {/* Home indicator */}
      <div className="mb-2.5 w-[68px] h-[4px] rounded-full bg-white/[0.12]" />
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
      <style>{`
        /* ── Floating scales background icon ── */
        @keyframes floatScale {
          0%, 100% { transform: translateY(0px) rotate(-5deg); opacity: 0.05; }
          50%       { transform: translateY(-28px) rotate(5deg); opacity: 0.09; }
        }
        .landing-bg-icon { animation: floatScale 10s ease-in-out infinite; }

        /* ── Hero fade-up ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up   { animation: fadeUp 0.6s ease-out both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.4s; }

        /* ── Gold firefly particles ── */
        @keyframes particleRise {
          0%   { transform: translateY(0)      translateX(0px);  opacity: 0;   }
          8%   { opacity: 0.9; }
          50%  { transform: translateY(-42vh)  translateX(10px); opacity: 0.55;}
          92%  { opacity: 0.2; }
          100% { transform: translateY(-85vh)  translateX(-4px); opacity: 0;   }
        }

        /* ── CTA primary glow ── */
        @keyframes ctaGlow {
          0%, 100% {
            box-shadow:
              0 0 18px 2px  rgba(0,155,58,0.38),
              0 8px 32px -4px rgba(0,155,58,0.22);
          }
          50% {
            box-shadow:
              0 0 36px 8px  rgba(0,155,58,0.55),
              0 8px 48px -4px rgba(0,155,58,0.32);
          }
        }
        .cta-primary { animation: ctaGlow 2.8s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#07070f] text-white">
        {/* ── Minimal Landing Nav ── */}
        <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 sm:px-8 py-4 bg-[#07070f]/90 backdrop-blur-xl border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#009B3A]" />
            <span className="text-sm font-bold text-white tracking-tight">
              CourtWatch JA
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/about"
              className="hidden sm:block text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1"
            >
              About
            </Link>
            <Link
              href="/auth/login"
              className="text-xs font-medium text-white/70 hover:text-white px-3 py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="text-xs font-semibold bg-[#009B3A] hover:bg-[#00b344] text-white px-4 py-2 rounded-xl transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </header>

        {/* ── Hero ── */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#009B3A]/[0.04] via-transparent to-[#FED100]/[0.02] pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#07070f] to-transparent pointer-events-none" />

          {/* Gold firefly particles */}
          <Particles />

          {/* Animated background scale icon */}
          <div className="absolute right-[5%] top-1/2 -translate-y-1/2 pointer-events-none hidden lg:block">
            <Scale className="landing-bg-icon h-[420px] w-[420px] text-[#009B3A]" />
          </div>

          {/* Hero content */}
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <div className="fade-up fade-up-1 inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-[#009B3A]/20 bg-[#009B3A]/[0.07] text-[#009B3A] text-xs font-semibold uppercase tracking-wider">
              <Scale className="h-3.5 w-3.5" />
              Jamaican Court Information
            </div>

            <h1 className="fade-up fade-up-2 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
              Track Jamaican Court&nbsp;Cases
              <span className="block text-[#009B3A]">as they happen.</span>
            </h1>

            <p className="fade-up fade-up-3 text-base sm:text-xl text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
              Search Supreme Court judgments, browse court lists, and get
              notified when your case is listed. All in one place.
            </p>

            {/* CTA buttons — primary has pulsing glow */}
            <div className="fade-up fade-up-3 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signup"
                className="cta-primary inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#009B3A] hover:bg-[#00b344] text-white font-semibold rounded-2xl transition-colors text-base"
              >
                Get Started — It&apos;s Free
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center px-8 py-4 border border-white/20 text-white font-semibold rounded-2xl hover:border-white/40 hover:bg-white/[0.04] transition-colors text-base"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* ── Preview Section ── */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <ScrollFadeIn>
              <div className="text-center mb-14">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  See What&apos;s Inside
                </h2>
                <p className="text-white/45 text-sm sm:text-base max-w-lg mx-auto">
                  Live data from Jamaican courts | no account required to
                  preview.
                </p>
              </div>
            </ScrollFadeIn>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Judgments column */}
              <ScrollFadeIn delay={0}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#009B3A]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#009B3A]">
                      Recent Judgments
                    </span>
                  </div>
                  <button
                    onClick={handleViewAll}
                    className="flex items-center gap-1 text-[11px] text-white/65 hover:text-white/80 transition-colors"
                  >
                    View All
                    <ArrowUpRight className="h-3 w-3" />
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
                          className="h-24 rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse"
                        />
                      ))}
                </div>
              </ScrollFadeIn>

              {/* Sittings column */}
              <ScrollFadeIn delay={150}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#FED100]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#FED100]">
                      Upcoming Sittings
                    </span>
                  </div>
                  <button
                    onClick={handleViewAll}
                    className="flex items-center gap-1 text-[11px] text-white/65 hover:text-white/80 transition-colors"
                  >
                    View All
                    <ArrowUpRight className="h-3 w-3" />
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
                          className="h-24 rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse"
                        />
                      ))}
                </div>
              </ScrollFadeIn>
            </div>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section className="py-24 px-6 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <ScrollFadeIn>
              <div className="text-center mb-14">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  Why CourtWatch JA?
                </h2>
                <p className="text-white/45 text-sm sm:text-base max-w-md mx-auto">
                  Built for lawyers, journalists, students, and anyone
                  navigating the Jamaican legal system.
                </p>
              </div>
            </ScrollFadeIn>

            <div className="grid sm:grid-cols-3 gap-5">
              <ScrollFadeIn delay={0}>
                <FeatureCard
                  icon={Calendar}
                  title="Jamaica Supreme Court & Appeal Lists"
                  description="Court lists updated Monday, Wednesday, and Friday directly from official Jamaica Supreme Court and Court of Appeal sources."
                  accent="green"
                />
              </ScrollFadeIn>
              <ScrollFadeIn delay={120}>
                <FeatureCard
                  icon={Bell}
                  title="Track Any Jamaican Case"
                  description="Enter your case number and get notified by email the moment it appears on a Jamaican court list or a new judgment is filed."
                  accent="gold"
                />
              </ScrollFadeIn>
              <ScrollFadeIn delay={240}>
                <FeatureCard
                  icon={Users}
                  title="Legal Research & Analytics"
                  description="Browse Jamaica's judicial records, explore the Judicial Constellation — a 3D map of judges — and search Parish Court criminal case data by parish."
                  accent="purple"
                />
              </ScrollFadeIn>
            </div>
          </div>
        </section>

        {/* ── App Store Banner ── */}
        <section className="py-24 px-6 border-t border-white/[0.04]">
          <div className="max-w-4xl mx-auto">
            <ScrollFadeIn>
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8 sm:p-12">
                <div className="flex flex-col lg:flex-row items-center gap-10">
                  <div className="lg:w-1/3 flex justify-center">
                    <PhoneMockup />
                  </div>

                  <div className="lg:w-2/3 text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-[#FED100]/15 bg-[#FED100]/[0.05] text-[#FED100] text-[11px] font-semibold uppercase tracking-wider">
                      <TrendingUp className="h-3 w-3" />
                      Coming Soon
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
                      Coming to App Store &amp;{" "}
                      <br className="hidden sm:block" />
                      Google Play
                    </h2>
                    <p className="text-white/50 text-sm sm:text-base mb-8 leading-relaxed max-w-md lg:max-w-none">
                      For now, use our web app it works great on mobile. Add it
                      to your home screen for an app-like experience.
                    </p>

                    <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                      {/* Apple App Store badge */}
                      <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/10 bg-white/[0.03] opacity-50 cursor-not-allowed select-none">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6 text-white fill-current"
                          aria-hidden="true"
                        >
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                        <div>
                          <p className="text-[9px] text-white/50 leading-none">
                            Coming Soon
                          </p>
                          <p className="text-xs font-semibold text-white leading-tight mt-0.5">
                            App Store
                          </p>
                        </div>
                      </div>

                      {/* Google Play badge */}
                      <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/10 bg-white/[0.03] opacity-50 cursor-not-allowed select-none">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6 text-white fill-current"
                          aria-hidden="true"
                        >
                          <path d="M3,20.5v-17c0-0.83,0.94-1.3,1.6-0.8l14,8.5c0.6,0.36,0.6,1.24,0,1.6l-14,8.5C3.94,21.8,3,21.33,3,20.5z" />
                        </svg>
                        <div>
                          <p className="text-[9px] text-white/50 leading-none">
                            Coming Soon
                          </p>
                          <p className="text-xs font-semibold text-white leading-tight mt-0.5">
                            Google Play
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollFadeIn>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/[0.05] py-10 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-white/70">
              <Scale className="h-4 w-4" />
              <span className="text-sm">
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
                  className="text-xs text-white/65 hover:text-white/85 transition-colors"
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
      <div className="flex items-center justify-center min-h-screen bg-[#07070f]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#009B3A]" />
      </div>
    );
  }

  if (pageState === "authed") {
    return <Dashboard />;
  }

  return <LandingPage />;
}
