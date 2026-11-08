"use client";

// Landing page shown on "/" to visitors who aren't logged in (glass design,
// styles in glass.module.css).

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Calendar,
  FileText,
  Scale,
  Users,
  X,
} from "lucide-react";
import { CourtSitting, Judgment } from "@/lib/types";
import s from "./glass.module.css";

interface PublicPreview {
  judgments: Judgment[];
  sittings: CourtSitting[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-JM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

// Structured data for search engines (carried over from the previous landing page).
const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CourtWatch JA",
  url: "https://courtwatchjamaica.com",
  description:
    "Free Jamaican court case tracker. Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, track cases, and get notified.",
  foundingLocation: { "@type": "Country", name: "Jamaica" },
  areaServed: { "@type": "Country", name: "Jamaica" },
};

// ── Sign-up popup ────────────────────────────────────────────────────────────

function SignUpPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        className={cx(s.glassCard, s.modal)}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className={s.close} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <span className={s.iconChip}>
          <Scale className="h-5 w-5" />
        </span>
        <h3 className={s.modalTitle}>Track your court cases for free</h3>
        <p className={s.modalText}>
          Sign up or log in to get notified when your case is listed, search
          judgments, and more.
        </p>
        <div className={s.modalBtns}>
          <Link href="/auth/signup" className={cx(s.btn, s.btnGreen)}>
            Sign up free
          </Link>
          <Link href="/auth/login" className={cx(s.btn, s.btnGlass)}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Preview cards ────────────────────────────────────────────────────────────

function JudgmentItem({ judgment, onClick }: { judgment: Judgment; onClick: () => void }) {
  return (
    <button onClick={onClick} className={s.item}>
      <div className={s.itemMeta}>
        <div className={s.itemMetaLeft}>
          {judgment.court && <span className={s.court}>{judgment.court}</span>}
          {judgment.date && <span className={s.date}>{formatDate(judgment.date)}</span>}
        </div>
        <ArrowUpRight className={cx("h-4 w-4", s.arrow)} />
      </div>
      <p className={s.itemTitle}>{judgment.title || judgment.case_number}</p>
      {judgment.summary_text && <p className={s.itemSub}>{judgment.summary_text}</p>}
    </button>
  );
}

function SittingItem({ sitting, onClick }: { sitting: CourtSitting; onClick: () => void }) {
  return (
    <button onClick={onClick} className={s.item}>
      <div className={s.itemMeta}>
        <div className={s.itemMetaLeft}>
          {sitting.event_date && (
            <span className={s.dateStrong}>{formatDate(sitting.event_date)}</span>
          )}
          {sitting.event_type && <span className={s.date}>{sitting.event_type}</span>}
        </div>
        <ArrowUpRight className={cx("h-4 w-4", s.arrow)} />
      </div>
      <p className={s.itemTitle}>
        {sitting.title || sitting.case_number || "Untitled Sitting"}
      </p>
      {sitting.court_division && <p className={s.itemSub}>{sitting.court_division}</p>}
    </button>
  );
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className={s.skeleton} />
      ))}
    </>
  );
}

// ── Feature tile ─────────────────────────────────────────────────────────────

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
    <div className={cx(s.glassCard, s.feature)}>
      <div className={s.featureIcon}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className={s.featureTitle}>{title}</h3>
      <p className={s.featureText}>{description}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GlassLanding() {
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

  const openPopup = useCallback(() => setShowPopup(true), []);
  const closePopup = useCallback(() => setShowPopup(false), []);

  return (
    <div className={s.root}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ORG_SCHEMA).replace(/</g, "\\u003c"),
        }}
      />
      <div className={s.glow} aria-hidden="true" />

      <div className={s.page}>
        {/* ── Floating pill nav ── */}
        <nav className={s.nav} aria-label="Main">
          <span className={s.brand}>
            <Scale className="h-5 w-5" />
            CourtWatch JA
          </span>
          <div className={s.navLinks}>
            <Link href="/about" className={cx(s.navLink, s.hideSm)}>
              About
            </Link>
            <Link href="/auth/login" className={s.navLink}>
              Sign in
            </Link>
            <Link href="/auth/signup" className={cx(s.btn, s.btnGreen, s.btnSm)}>
              Get started
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <header className={s.hero}>
          <div className={s.heroPhotoWrap} aria-hidden="true">
            <Image
              src="/images/hero-judge-alert.jpg"
              alt=""
              fill
              priority
              sizes="(min-width: 900px) 65vw, 100vw"
              className={s.heroPhoto}
            />
          </div>
          <div className={s.heroShade} aria-hidden="true" />
          <div className={s.heroInner}>
            <h1 className={s.h1}>Track Jamaican court cases as they happen.</h1>
            <p className={s.lead}>
              Search Supreme Court and Court of Appeal judgments, browse
              upcoming court lists, and get an email the moment your case is
              listed. Free to use.
            </p>
            <div className={s.heroCtas}>
              <Link href="/auth/signup" className={cx(s.btn, s.btnGreen)}>
                Get started, it&apos;s free
              </Link>
              <Link href="/auth/login" className={cx(s.btn, s.btnGlass)}>
                Sign in
              </Link>
            </div>
          </div>
          <div className={s.heroNote}>
            <span className={s.notePill}>
              Data sourced from the Supreme Court and Court of Appeal of Jamaica.
            </span>
            <span className={s.notePill}>
              Lists updated Monday, Wednesday, and Friday.
            </span>
          </div>
        </header>

        <main style={{ display: "contents" }}>
          {/* ── Preview ── */}
          <section className={s.sectionHead}>
            <h2 className={s.h2}>
              See what&apos;s <span className={s.green}>inside</span>
            </h2>
            <p className={s.lead}>
              Live data from Jamaican courts. No account required to preview.
            </p>
          </section>

          <section className={s.previewGrid}>
            <div className={cx(s.glassCard, s.panel)}>
              <div className={s.panelHead}>
                <span className={s.panelTitle}>
                  <span className={s.iconChip}>
                    <FileText className="h-4 w-4" />
                  </span>
                  Recent judgments
                </span>
                <button onClick={openPopup} className={s.viewAll}>
                  View all
                </button>
              </div>
              <div className={s.list}>
                {preview?.judgments && preview.judgments.length > 0 ? (
                  preview.judgments.map((j) => (
                    <JudgmentItem key={j.id} judgment={j} onClick={openPopup} />
                  ))
                ) : (
                  <Skeletons />
                )}
              </div>
            </div>

            <div className={cx(s.glassCard, s.panel)}>
              <div className={s.panelHead}>
                <span className={s.panelTitle}>
                  <span className={s.iconChip}>
                    <Calendar className="h-4 w-4" />
                  </span>
                  Upcoming sittings
                </span>
                <button onClick={openPopup} className={s.viewAll}>
                  View all
                </button>
              </div>
              <div className={s.list}>
                {preview?.sittings && preview.sittings.length > 0 ? (
                  preview.sittings.map((st) => (
                    <SittingItem key={st.id} sitting={st} onClick={openPopup} />
                  ))
                ) : (
                  <Skeletons />
                )}
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section className={s.sectionHead}>
            <h2 className={s.h2}>
              Why <span className={s.green}>CourtWatch JA?</span>
            </h2>
            <p className={s.lead}>
              Built for lawyers, journalists, students, and anyone navigating
              the Jamaican legal system.
            </p>
          </section>

          <section className={s.features}>
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
          </section>

          {/* ── App band ── */}
          <section className={s.band}>
            <div>
              <h2 className={s.h2}>Coming to the App Store &amp; Google Play</h2>
              <p className={s.lead}>
                For now, the web app works great on mobile. Add it to your home
                screen for an app experience.
              </p>
            </div>
            <Link href="/auth/signup" className={cx(s.btn, s.btnGlass)}>
              Use the web app
            </Link>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className={cx(s.glassCard, s.foot)}>
          <span className={s.footBrand}>
            <Scale className="h-4 w-4" />
            © 2026 CourtWatch JA. Made in Jamaica.
          </span>
          <nav className={s.footLinks}>
            {[
              { href: "/about", label: "About" },
              { href: "/privacy", label: "Privacy Policy" },
              { href: "/terms", label: "Terms of Service" },
              { href: "mailto:courtwatchjamaica@protonmail.com", label: "Contact" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>

      {showPopup && <SignUpPopup onClose={closePopup} />}
    </div>
  );
}
