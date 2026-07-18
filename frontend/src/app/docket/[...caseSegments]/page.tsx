"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { formatDateOnly, isPastDateOnly, parseDateOnly } from "@/lib/dates";
import { DocketDetail } from "@/lib/types";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Download,
  Gavel,
  BookOpen,
  MapPin,
  Clock,
  ChevronRight,
  AlertTriangle,
  Trash2,
  X,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null | undefined): string {
  return formatDateOnly(s, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(s: string | null | undefined): string {
  return formatDateOnly(s, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(s: string | null | undefined): string {
  if (!s) return "—";
  const [h, m] = s.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// ── Untrack confirmation modal ────────────────────────────────────────────────

function UntrackModal({
  caseNumber,
  onConfirm,
  onCancel,
  loading,
}: {
  caseNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Untrack this case?</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{caseNumber}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          You will stop receiving alerts for this case. You can re-track it at any time from the Cases page.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {loading ? "Removing…" : "Untrack"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab strip ─────────────────────────────────────────────────────────────────

type Tab = "judgment" | "sittings";

function TabStrip({
  active,
  onChange,
  hasJudgment,
  sittingsCount,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  hasJudgment: boolean;
  sittingsCount: number;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border">
      <button
        onClick={() => onChange("judgment")}
        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          active === "judgment"
            ? "bg-card shadow-sm text-foreground border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        Judgment
        {hasJudgment && (
          <span className="rounded-full bg-[#009B3A]/20 px-1.5 py-px text-[10px] font-bold text-[#009B3A]">
            1
          </span>
        )}
      </button>
      <button
        onClick={() => onChange("sittings")}
        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          active === "sittings"
            ? "bg-card shadow-sm text-foreground border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Calendar className="h-3.5 w-3.5" />
        Sittings
        {sittingsCount > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
            {sittingsCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ── Judgment tab ──────────────────────────────────────────────────────────────

function JudgmentTab({ detail }: { detail: DocketDetail }) {
  const j = detail.judgment;

  if (!j) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted/30">
          <BookOpen className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No judgment on record
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60 max-w-[220px] mx-auto">
          When a judgment for{" "}
          <span className="font-mono font-semibold">{detail.case_number}</span>{" "}
          is published, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main judgment card */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                Judgment
              </p>
              <h2 className="text-base font-semibold text-foreground leading-snug">
                {j.title ?? detail.case_number}
              </h2>
            </div>
            {(j.pdf_url || j.local_pdf_path) && (
              <a
                href={j.pdf_url ?? `/api/pdf/judgment/${j.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#009B3A]/10 border border-[#009B3A]/30 px-3 py-2 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </a>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">
                Judge
              </p>
              <p className="font-medium text-foreground">
                {j.judge_name ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">
                Court
              </p>
              <p className="font-medium text-foreground">{j.court ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">
                Date
              </p>
              <p className="font-medium text-foreground">
                {j.date ? formatDateShort(j.date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-0.5">
                Case Number
              </p>
              <p className="font-mono font-semibold text-foreground">
                {j.case_number}
              </p>
            </div>
          </div>

          {j.tags && j.tags.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex flex-wrap gap-1.5">
                {j.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground capitalize"
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {j.summary_text && (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
            Summary
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {j.summary_text}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sittings tab ──────────────────────────────────────────────────────────────

function SittingsTab({ detail }: { detail: DocketDetail }) {
  const { sittings } = detail;

  if (sittings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted/30">
          <Calendar className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No court sittings found
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Sittings will appear here as they are listed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {sittings.map((s, i) => {
        const isPast = isPastDateOnly(s.event_date);
        return (
          <div
            key={s.id}
            className={`flex items-start gap-4 px-5 py-4 border-b last:border-0 border-border/50 transition-opacity ${
              isPast ? "opacity-50" : "bg-[#009B3A]/[0.03]"
            }`}
          >
            {/* Date column */}
            <div className="shrink-0 w-24 text-right">
              {s.event_date ? (
                <>
                  <p className={`text-sm font-bold ${isPast ? "text-foreground/60" : "text-[#009B3A]"}`}>
                    {formatDateOnly(s.event_date, { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    {parseDateOnly(s.event_date).getFullYear()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Timeline dot + connector */}
            <div className="flex flex-col items-center pt-1.5 self-stretch">
              <div className={`h-2 w-2 shrink-0 rounded-full ${isPast ? "bg-muted-foreground/25" : "bg-[#009B3A]"}`} />
              {i < sittings.length - 1 && (
                <div className="mt-1 w-px flex-1 bg-border/60" />
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1">
                <span className={`text-sm font-semibold ${isPast ? "text-foreground/60" : "text-foreground"}`}>
                  {s.event_type ?? "Hearing"}
                </span>
                {isPast ? (
                  <span className="rounded-sm bg-muted/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-11 w-full rounded-xl bg-muted/60" />
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-5 w-64 rounded bg-muted/70" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-12 rounded bg-muted/50" />
              <div className="h-4 w-24 rounded bg-muted/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocketDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ caseSegments: string[] }>;
}) {
  const params = use(paramsPromise);
  const caseNumber = params.caseSegments.join("/");
  const router = useRouter();

  const [detail, setDetail] = useState<DocketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notTracking, setNotTracking] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("sittings");
  const [showUntrack, setShowUntrack] = useState(false);
  const [untracking, setUntracking] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDocketDetail(caseNumber);
      setDetail(data);
      // Default to judgment tab if one exists, otherwise sittings
      if (data.judgment) setActiveTab("judgment");
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404 || status === 401) {
        setNotTracking(true);
      }
    } finally {
      setLoading(false);
    }
  }, [caseNumber]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleUntrack = async () => {
    if (!detail) return;
    setUntracking(true);
    try {
      await apiClient.removeUserCaseByRow(detail.user_case_id);
      router.push("/docket");
    } catch {
      setUntracking(false);
      setShowUntrack(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        {showUntrack && detail && (
          <UntrackModal
            caseNumber={caseNumber}
            onConfirm={handleUntrack}
            onCancel={() => setShowUntrack(false)}
            loading={untracking}
          />
        )}

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-16">

          {/* Back link */}
          <div className="mb-5">
            <Link
              href="/docket"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              My Docket
            </Link>
          </div>

          {/* Not tracking redirect state */}
          {notTracking && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-foreground">Not tracking this case</p>
              <p className="mt-1 text-xs text-muted-foreground/70 max-w-[220px] mx-auto">
                You must be tracking{" "}
                <span className="font-mono font-semibold">{caseNumber}</span>{" "}
                to view its docket.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
                <Link
                  href="/docket"
                  className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Back to My Docket
                </Link>
                <Link
                  href="/cases"
                  className="flex items-center gap-1.5 rounded-xl bg-[#009B3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#009B3A]/90 transition-colors"
                >
                  Browse Cases
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && <Skeleton />}

          {/* Content */}
          {!loading && !notTracking && detail && (
            <>
              {/* Case header */}
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">
                    Case File
                  </p>
                  <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
                    {caseNumber}
                  </h1>
                </div>

                <button
                  onClick={() => setShowUntrack(true)}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Untrack
                </button>
              </div>

              {/* Tab strip */}
              <div className="mb-5">
                <TabStrip
                  active={activeTab}
                  onChange={setActiveTab}
                  hasJudgment={detail.judgment !== null}
                  sittingsCount={detail.sittings.length}
                />
              </div>

              {/* Tab content */}
              {activeTab === "judgment" && <JudgmentTab detail={detail} />}
              {activeTab === "sittings" && <SittingsTab detail={detail} />}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
