"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
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
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-JM", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) >= new Date(new Date().toDateString());
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
      className="group w-full text-left rounded-2xl border border-border bg-card hover:bg-muted/20 hover:border-[#009B3A]/40 transition-all duration-200 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Case number */}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="font-mono text-base font-bold text-foreground tracking-tight">
              {item.case_number}
            </span>
            {item.unread_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#009B3A]/15 px-2 py-0.5 text-[10px] font-bold text-[#009B3A]">
                <Bell className="h-2.5 w-2.5" />
                {item.unread_count}
              </span>
            )}
          </div>

          {/* Next sitting */}
          {hasUpcoming ? (
            <div className={`flex items-center gap-2 text-xs ${upcoming ? "text-[#009B3A]" : "text-muted-foreground"}`}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">
                {item.next_event_type ?? "Hearing"}
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span>{formatDate(item.next_event_date)}</span>
              {item.next_court_division && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="truncate">{item.next_court_division}</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>No upcoming sittings</span>
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-[#009B3A] group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
      </div>

      {/* Tracked since */}
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
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
            <div className="h-5 w-32 rounded bg-muted font-mono" />
          </div>
          <div className="h-3.5 w-48 rounded bg-muted/60" />
        </div>
        <div className="h-4 w-4 rounded bg-muted/40 mt-0.5" />
      </div>
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="h-3 w-36 rounded bg-muted/40" />
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
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[#009B3A]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                  Case Files
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                My Docket
              </h1>
              {!loading && items.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {items.length} case{items.length !== 1 ? "s" : ""} tracked
                  {upcomingCount > 0 && (
                    <> · <span className="text-[#009B3A] font-medium">{upcomingCount} upcoming</span></>
                  )}
                  {totalUnread > 0 && (
                    <> · <span className="text-[#009B3A] font-medium">{totalUnread} unread</span></>
                  )}
                </p>
              )}
            </div>

            <button
              onClick={() => router.push("/cases")}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#009B3A]/10 border border-[#009B3A]/30 px-3.5 py-2.5 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Track new case
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
            <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
                <FolderOpen className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                You aren&apos;t tracking any cases yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60 max-w-[240px]">
                Browse cases to start tracking hearings and receive alerts when
                they&apos;re updated.
              </p>
              <button
                onClick={() => router.push("/cases")}
                className="mt-5 flex items-center gap-1.5 rounded-xl bg-[#009B3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#009B3A]/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Browse Cases
              </button>
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
