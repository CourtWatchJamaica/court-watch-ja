"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { CourtSitting, Judgment } from "@/lib/types";
import { useTracking } from "@/lib/tracking-context";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Gavel,
  MapPin,
  FileText,
  BookOpen,
  Download,
  CheckCircle2,
  ListPlus,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateShort(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-JM", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(s: string | null | undefined): string {
  if (!s) return "";
  const [h, m] = s.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Sittings timeline ─────────────────────────────────────────────────────────

function SittingsTimeline({ sittings }: { sittings: CourtSitting[] }) {
  if (sittings.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No court sittings on record for this case.</p>
      </div>
    );
  }

  const today = new Date(new Date().toDateString());

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {sittings.map((s, i) => {
        const isPast = !s.event_date || new Date(s.event_date) < today;
        return (
          <div
            key={s.id}
            className={`flex items-start gap-4 px-5 py-4 border-b last:border-0 border-border/50 transition-opacity ${
              isPast ? "opacity-50" : "bg-[#009B3A]/[0.03]"
            }`}
          >
            {/* Date */}
            <div className="shrink-0 w-24 text-right">
              {s.event_date ? (
                <>
                  <p className={`text-sm font-bold ${isPast ? "text-foreground/60" : "text-[#009B3A]"}`}>
                    {new Date(s.event_date).toLocaleDateString("en-JM", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    {new Date(s.event_date).getFullYear()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Timeline dot + connector */}
            <div className="flex flex-col items-center pt-1.5 self-stretch">
              <div className={`h-2 w-2 shrink-0 rounded-full ${isPast ? "bg-muted-foreground/25" : "bg-[#009B3A]"}`} />
              {i < sittings.length - 1 && <div className="mt-1 w-px flex-1 bg-border/60" />}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1">
                <span className={`text-sm font-semibold ${isPast ? "text-foreground/60" : "text-foreground"}`}>
                  {s.event_type ?? "Hearing"}
                </span>
                {isPast ? (
                  <span className="rounded-full bg-muted/60 px-2 py-px text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                    Past
                  </span>
                ) : (
                  <span className="rounded-full bg-[#009B3A]/15 px-2 py-px text-[10px] font-bold text-[#009B3A]">
                    Upcoming
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {s.event_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(s.event_time)}
                  </span>
                )}
                {s.judge_name && (
                  <span className="flex items-center gap-1">
                    <Gavel className="h-3 w-3" />
                    {s.judge_name}
                  </span>
                )}
                {s.court_division && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {s.court_division}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Judgment card ─────────────────────────────────────────────────────────────

function JudgmentCard({ judgment, caseNumber }: { judgment: Judgment | null; caseNumber: string }) {
  if (!judgment) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <BookOpen className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No judgment on record for{" "}
          <span className="font-mono font-semibold">{caseNumber}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Judgment</p>
          <h3 className="text-base font-semibold text-foreground leading-snug">{judgment.title ?? caseNumber}</h3>
        </div>
        {(judgment.pdf_url || judgment.local_pdf_path) && (
          <a
            href={judgment.pdf_url ?? `/api/pdf/judgment/${judgment.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#009B3A]/10 border border-[#009B3A]/30 px-3 py-2 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>
        )}
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">Judge</p>
          <p className="font-medium text-foreground">{judgment.judge_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">Date</p>
          <p className="font-medium text-foreground">{judgment.date ? formatDateShort(judgment.date) : "—"}</p>
        </div>
      </div>
      {judgment.summary_text && (
        <div className="px-5 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Summary</p>
          <p className="text-sm text-foreground/75 leading-relaxed">{judgment.summary_text}</p>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-12 w-full rounded-2xl bg-muted/60" />
      <div className="h-32 w-full rounded-2xl bg-muted/40" />
      <div className="h-48 w-full rounded-2xl bg-muted/40" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaseHistoryPage({
  params: paramsPromise,
}: {
  params: Promise<{ caseNumber: string }>;
}) {
  const params = use(paramsPromise);
  const caseNumber = decodeURIComponent(params.caseNumber).toUpperCase();
  const router = useRouter();
  const { isTracked, track } = useTracking();

  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [activeTab, setActiveTab] = useState<"sittings" | "judgment">("sittings");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCaseHistory(caseNumber);
      setSittings(data.sittings);
      setJudgment(data.judgment);
      if (data.judgment) setActiveTab("judgment");
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [caseNumber]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const alreadyTracked = judgment
    ? isTracked(judgment.id, "judgment")
    : sittings.length > 0
    ? isTracked(sittings[0].id, "sitting")
    : false;

  const handleTrack = async () => {
    setTracking(true);
    try {
      await apiClient.addUserCaseByNumber(caseNumber, "sitting");
      router.push(`/docket/${encodeURIComponent(caseNumber)}`);
    } catch {
      setTracking(false);
    }
  };

  const upcomingCount = sittings.filter(
    (s) => s.event_date && new Date(s.event_date) >= new Date(new Date().toDateString()),
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-16">

        {/* Back */}
        <div className="mb-5">
          <Link
            href="/cases?tab=sittings"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Court Lists
          </Link>
        </div>

        {loading && <PageSkeleton />}

        {!loading && notFound && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground">Case not found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              No records found for <span className="font-mono font-semibold">{caseNumber}</span>.
            </p>
            <Link
              href="/cases?tab=sittings"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#009B3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#009B3A]/90 transition-colors"
            >
              Browse Court Lists
            </Link>
          </div>
        )}

        {!loading && !notFound && (
          <>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">
                  Case File
                </p>
                <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
                  {caseNumber}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  {sittings.length} sitting{sittings.length !== 1 ? "s" : ""}
                  {upcomingCount > 0 && (
                    <> · <span className="text-[#009B3A] font-semibold">{upcomingCount} upcoming</span></>
                  )}
                  {judgment && <> · Judgment available</>}
                </p>
              </div>

              {/* Track / Tracked button */}
              {alreadyTracked ? (
                <button
                  onClick={() => router.push(`/docket/${encodeURIComponent(caseNumber)}`)}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/10 px-4 py-2.5 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  View My Docket
                </button>
              ) : (
                <button
                  onClick={handleTrack}
                  disabled={tracking}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground/70 hover:border-[#009B3A]/40 hover:text-[#009B3A] hover:bg-[#009B3A]/[0.06] disabled:opacity-60 transition-colors"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  {tracking ? "Adding…" : "Track in My Docket"}
                </button>
              )}
            </div>

            {/* Tab strip */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border mb-5">
              <button
                onClick={() => setActiveTab("sittings")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === "sittings"
                    ? "bg-card shadow-sm text-foreground border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Sittings
                {sittings.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                    {sittings.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("judgment")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === "judgment"
                    ? "bg-card shadow-sm text-foreground border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Judgment
                {judgment && (
                  <span className="rounded-full bg-[#009B3A]/20 px-1.5 py-px text-[10px] font-bold text-[#009B3A]">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            {activeTab === "sittings" && <SittingsTimeline sittings={sittings} />}
            {activeTab === "judgment" && <JudgmentCard judgment={judgment} caseNumber={caseNumber} />}

            {/* Docket CTA banner */}
            {!alreadyTracked && (
              <div className="mt-5 rounded-2xl border border-[#009B3A]/20 bg-[#009B3A]/[0.04] p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Get notified about updates</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Track this case to receive alerts when new sittings are listed.
                  </p>
                </div>
                <button
                  onClick={handleTrack}
                  disabled={tracking}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#009B3A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#009B3A]/90 disabled:opacity-60 transition-colors"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  {tracking ? "Adding…" : "Track Case"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
