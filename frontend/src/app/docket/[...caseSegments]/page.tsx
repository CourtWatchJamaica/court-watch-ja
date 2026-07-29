"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { formatDateOnly, isPastDateOnly, parseDateOnly } from "@/lib/dates";
import { DocketDetail } from "@/lib/types";
import { NotifModal, type NotifSettings } from "@/components/NotifModal";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Download,
  Gavel,
  MapPin,
  Clock,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Bell,
  BellOff,
  Landmark,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function notifSettingsOf(d: DocketDetail): NotifSettings {
  return {
    notify_immediately: d.notify_immediately,
    notify_day_before: d.notify_day_before,
    notify_morning_of: d.notify_morning_of,
  };
}

// ── Merged history timeline ────────────────────────────────────────────────────

type TimelineEntry =
  | { kind: "hearing"; date: string | null; sortKey: number; id: number; eventType: string | null; time: string | null; judge: string | null; division: string | null; isPast: boolean }
  | { kind: "judgment"; date: string | null; sortKey: number; id: number; title: string | null; judge: string | null; court: string | null; summary: string | null; pdfUrl: string | null; tags: string[] };

function buildTimeline(detail: DocketDetail): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const s of detail.sittings) {
    entries.push({
      kind: "hearing",
      date: s.event_date,
      sortKey: s.event_date ? parseDateOnly(s.event_date).getTime() : -Infinity,
      id: s.id,
      eventType: s.event_type,
      time: s.event_time,
      judge: s.judge_name,
      division: s.court_division,
      isPast: isPastDateOnly(s.event_date),
    });
  }

  if (detail.judgment) {
    const j = detail.judgment;
    entries.push({
      kind: "judgment",
      date: j.date,
      sortKey: j.date ? parseDateOnly(j.date).getTime() : -Infinity,
      id: j.id,
      title: j.title ?? "Judgment delivered",
      judge: j.judge_name,
      court: j.court,
      summary: j.summary_text ?? null,
      pdfUrl: j.pdf_url ?? (j.local_pdf_path ? `/api/pdf/judgment/${j.id}` : null),
      tags: j.tags ?? [],
    });
  }

  // Newest / upcoming first; undated entries sink to the bottom.
  return entries.sort((a, b) => b.sortKey - a.sortKey);
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
          <ArrowLeft className="h-4 w-4 rotate-45" />
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

// ── Alert pill (shared look with /docket list) ──────────────────────────────────

function AlertPill({ settings, onClick }: { settings: NotifSettings; onClick: () => void }) {
  const n = Object.values(settings).filter(Boolean).length;

  if (n === 0) {
    return (
      <button
        onClick={onClick}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground/25 hover:text-foreground/50 hover:border-foreground/20 transition-colors"
      >
        <BellOff className="h-3.5 w-3.5" />
        Muted
      </button>
    );
  }
  if (n === 3) {
    return (
      <button
        onClick={onClick}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.14] px-3 py-2 text-xs font-bold text-accent hover:bg-accent/[0.22] transition-colors"
      >
        <Bell className="h-3.5 w-3.5" />
        Alerts on
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground/45 hover:text-foreground hover:border-accent/35 transition-colors"
    >
      <Bell className="h-3.5 w-3.5" />
      {n}/3 alerts
    </button>
  );
}

// ── History timeline ──────────────────────────────────────────────────────────

function HistoryTimeline({ detail }: { detail: DocketDetail }) {
  const entries = useMemo(() => buildTimeline(detail), [detail]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted/30">
          <Calendar className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No history yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Hearings and judgments for{" "}
          <span className="font-mono font-semibold">{detail.case_number}</span>{" "}
          will appear here as they&apos;re listed.
        </p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        const isJudgment = entry.kind === "judgment";
        const isUpcoming = entry.kind === "hearing" && !entry.isPast;

        return (
          <div key={`${entry.kind}-${entry.id}`} className="relative flex items-start gap-4 pb-6 last:pb-0">
            {/* Rail */}
            <div className="flex flex-col items-center self-stretch shrink-0 w-3 pt-1.5">
              <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-background ${
                  isJudgment
                    ? "bg-accent"
                    : isUpcoming
                      ? "bg-primary"
                      : "bg-muted-foreground/25"
                }`}
              />
              {!isLast && <div className="mt-1 w-px flex-1 bg-border/60" />}
            </div>

            {/* Card */}
            <div
              className={`flex-1 min-w-0 rounded-lg border bg-card p-4 transition-opacity ${
                isJudgment
                  ? "border-accent/25"
                  : isUpcoming
                    ? "border-primary/25 shadow-sm"
                    : "border-border/70 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                <span className="text-xs font-bold text-foreground font-mono tabular-nums">
                  {entry.date ? formatDateShort(entry.date) : "Date TBD"}
                </span>
                {isJudgment ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    <Gavel className="h-2.5 w-2.5" />
                    Judgment
                  </span>
                ) : isUpcoming ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Upcoming
                  </span>
                ) : (
                  <span className="rounded-sm bg-muted/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    Past
                  </span>
                )}
              </div>

              {entry.kind === "hearing" ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {entry.eventType ?? "Hearing"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {entry.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(entry.time)}
                      </span>
                    )}
                    {entry.judge && (
                      <span className="flex items-center gap-1">
                        <Gavel className="h-3 w-3" />
                        {entry.judge}
                      </span>
                    )}
                    {entry.division && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {entry.division}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {entry.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {entry.judge && (
                      <span className="flex items-center gap-1">
                        <Gavel className="h-3 w-3" />
                        {entry.judge}
                      </span>
                    )}
                    {entry.court && (
                      <span className="flex items-center gap-1">
                        <Landmark className="h-3 w-3" />
                        {entry.court}
                      </span>
                    )}
                  </div>

                  {entry.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
                        >
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  {entry.summary && (
                    <p className="mt-2.5 pt-2.5 border-t border-border/50 text-xs leading-relaxed text-foreground/75 whitespace-pre-line">
                      {entry.summary}
                    </p>
                  )}

                  {entry.pdfUrl && (
                    <a
                      href={entry.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/20 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Download judgment PDF
                    </a>
                  )}
                </>
              )}
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
  const [showUntrack, setShowUntrack] = useState(false);
  const [untracking, setUntracking] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDocketDetail(caseNumber);
      setDetail(data);
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

  const caseTitle = detail?.judgment?.title ?? null;

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

        {notifOpen && detail && (
          <NotifModal
            rowId={detail.user_case_id}
            initial={notifSettingsOf(detail)}
            caseLabel={caseTitle ? `${caseNumber} · ${caseTitle}` : caseNumber}
            onClose={() => { setNotifOpen(false); fetchDetail(); }}
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
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">
                    Case File
                  </p>
                  <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
                    {caseNumber}
                  </h1>
                  {caseTitle && (
                    <p className="mt-1 text-sm text-muted-foreground truncate">{caseTitle}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <AlertPill settings={notifSettingsOf(detail)} onClick={() => setNotifOpen(true)} />
                  <button
                    onClick={() => setShowUntrack(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Untrack
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {detail.sittings.length} hearing{detail.sittings.length !== 1 ? "s" : ""}
                </span>
                {detail.judgment && (
                  <>
                    <span className="text-foreground/15">·</span>
                    <span className="flex items-center gap-1.5">
                      <Gavel className="h-3.5 w-3.5" />
                      Judgment on record
                    </span>
                  </>
                )}
              </div>

              {/* History */}
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                History
              </p>
              <HistoryTimeline detail={detail} />
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
