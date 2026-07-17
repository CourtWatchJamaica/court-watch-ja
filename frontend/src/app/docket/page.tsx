"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { formatDateOnly, isPastDateOnly } from "@/lib/dates";
import { DocketListItem } from "@/lib/types";
import {
  FolderOpen,
  Calendar,
  Bell,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  return formatDateOnly(
    s,
    { weekday: "short", month: "short", day: "numeric", year: "numeric" },
    "",
  );
}

function isUpcoming(dateStr: string | null): boolean {
  return !isPastDateOnly(dateStr);
}

// ── Case card ─────────────────────────────────────────────────────────────────

function CaseCard({
  item,
  onClick,
}: {
  item: DocketListItem;
  onClick: () => void;
}) {
  const hasUpcoming = item.next_event_date !== null;
  const upcoming = hasUpcoming && isUpcoming(item.next_event_date);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-[0_8px_32px_rgba(0,196,74,0.06),0_2px_8px_rgba(0,0,0,0.5)] transition-all duration-250 p-5 hover:-translate-y-0.5"
    >
      {/* Ghost case number watermark */}
      <span
        aria-hidden
        className="pointer-events-none select-none absolute right-4 top-2 font-mono font-bold leading-none text-foreground/[0.035] overflow-hidden"
        style={{ fontSize: "3.5rem", maxWidth: "200px", display: "block", whiteSpace: "nowrap", textOverflow: "clip" }}
      >
        {item.case_number}
      </span>

      {/* Hover ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Case number */}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="font-mono text-base font-bold text-foreground tracking-tight">
              {item.case_number}
            </span>
            {item.unread_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Bell className="h-2.5 w-2.5" />
                {item.unread_count}
              </span>
            )}
          </div>

          {/* Next sitting */}
          {hasUpcoming ? (
            <div className={`flex items-center gap-2 text-xs ${upcoming ? "text-primary" : "text-foreground/40"}`}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">
                {item.next_event_type ?? "Hearing"}
              </span>
              <span className="text-foreground/20">·</span>
              <span>{formatDate(item.next_event_date)}</span>
              {item.next_court_division && (
                <>
                  <span className="text-foreground/20">·</span>
                  <span className="truncate">{item.next_court_division}</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-foreground/25">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>No upcoming sittings</span>
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-foreground/[0.18] group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
      </div>

      {/* Tracked since */}
      <div className="relative z-10 mt-3 pt-3 border-t border-foreground/[0.04] flex items-center gap-1.5 text-[11px] text-foreground/20">
        <Clock className="h-3 w-3" />
        <span>
          Tracked since{" "}
          {new Date(item.tracked_at).toLocaleDateString("en-JM", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Bottom hover line */}
      <div className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500 bg-gradient-to-r from-primary via-primary/40 to-transparent" />
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex gap-2 mb-1">
            <div className="h-5 w-32 rounded bg-foreground/[0.05] font-mono" />
          </div>
          <div className="h-3.5 w-48 rounded bg-foreground/[0.04]" />
        </div>
        <div className="h-4 w-4 rounded bg-foreground/[0.03] mt-0.5" />
      </div>
      <div className="mt-3 pt-3 border-t border-foreground/[0.04]">
        <div className="h-3 w-36 rounded bg-foreground/[0.03]" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocketPage() {
  const router = useRouter();
  const [items, setItems] = useState<DocketListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocket = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDocketList();
      setItems(data);
    } catch {
      /* swallow — AuthGuard handles auth errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocket(); }, [fetchDocket]);

  const navigateToCase = (caseNumber: string) => {
    router.push(`/docket/${caseNumber}`);
  };

  const totalUnread = items.reduce((sum, i) => sum + i.unread_count, 0);
  const upcomingCount = items.filter((i) => i.next_event_date !== null && isUpcoming(i.next_event_date)).length;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-16">

          {/* Header */}
          <div className="mb-10 flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-8 bg-primary/45" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary/65">
                  Case Files
                </span>
              </div>
              <h1 className="font-heading font-extrabold text-[2.8rem] sm:text-[3.5rem] leading-none tracking-tight text-foreground mb-2">
                My Docket<span className="text-primary">.</span>
              </h1>
              {!loading && items.length > 0 && (
                <p className="text-[13px] text-foreground/40">
                  {items.length} case{items.length !== 1 ? "s" : ""} tracked
                  {upcomingCount > 0 && (
                    <> · <span className="text-primary font-medium">{upcomingCount} upcoming</span></>
                  )}
                  {totalUnread > 0 && (
                    <> · <span className="text-primary font-medium">{totalUnread} unread</span></>
                  )}
                </p>
              )}
            </div>

            <button
              onClick={() => router.push("/cases")}
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-primary/22 bg-primary/[0.06] px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/[0.12] hover:border-primary/[0.32] transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Track new
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty */}
          {!loading && items.length === 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-24 text-center px-8">
              <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center font-heading font-extrabold text-[7rem] text-foreground/[0.02] overflow-hidden">
                EMPTY
              </span>
              <div className="relative z-10">
                <div className="mb-5 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted">
                  <FolderOpen className="h-7 w-7 text-foreground/[0.18]" />
                </div>
                <h2 className="font-heading font-bold text-xl text-foreground/75 mb-2">
                  Your docket is empty
                </h2>
                <p className="text-[13px] text-foreground/30 max-w-[240px] leading-relaxed mb-6">
                  Track cases to monitor hearings and receive alerts when they&apos;re updated.
                </p>
                <button
                  onClick={() => router.push("/cases")}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-black hover:bg-primary/90 transition-colors active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Browse Cases
                </button>
              </div>
            </div>
          )}

          {/* Case list */}
          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <CaseCard
                  key={item.user_case_id}
                  item={item}
                  onClick={() => navigateToCase(item.case_number)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
