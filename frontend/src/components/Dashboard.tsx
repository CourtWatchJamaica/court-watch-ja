"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import JudgmentCarousel from "@/components/JudgmentCarousel";
import DocketSection, { AddByNumberForm } from "@/components/DocketSection";
import LegalPulse from "@/components/LegalPulse";
import { apiClient } from "@/lib/api";
import { Judgment, UserCase, CourtSitting, User as UserProfile } from "@/lib/types";
import {
  Calendar,
  ArrowUpRight,
  Megaphone,
  X,
  User,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Notification } from "@/lib/types";
import WelcomeGuide from "@/components/WelcomeGuide";

function AnnouncementBanner({
  notif,
  onDismiss,
}: {
  notif: Notification;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-accent/[0.18] bg-accent/[0.04] px-4 py-3.5">
      <Megaphone className="h-4 w-4 text-accent shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {notif.title && (
          <p className="text-sm font-semibold text-accent leading-snug">
            {notif.title}
          </p>
        )}
        {notif.message && (
          <p className="mt-0.5 text-xs text-foreground/50 leading-relaxed">
            {notif.message}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-foreground/20 hover:text-foreground/60 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatSittingTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

interface TodaySittingsProps {
  sittings: CourtSitting[];
  loading: boolean;
}

function TodaySittings({ sittings, loading }: TodaySittingsProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const todaySittings = sittings.filter((s) => s.event_date === today);
  const upcoming = sittings
    .filter((s) => s.event_date && s.event_date > today)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
  const display =
    todaySittings.length > 0 ? todaySittings.slice(0, 5) : upcoming.slice(0, 5);
  const label =
    todaySittings.length > 0 ? "Today's Sittings" : "Upcoming Sittings";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-px w-8 bg-accent/45" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/65">
            {label}
          </span>
        </div>
        <button
          onClick={() => router.push("/court-sittings/today")}
          className="flex items-center gap-1 text-[11px] font-medium text-foreground/35 hover:text-foreground/70 transition-colors"
        >
          View All
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl bg-foreground/[0.04]" />
          ))}
        </div>
      ) : display.length > 0 ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {display.map((sitting) => (
            <div
              key={sitting.id}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors cursor-pointer"
              onClick={() => router.push(`/cases/sittings/${sitting.id}`)}
            >
              <div className="shrink-0 text-center min-w-[44px]">
                {sitting.event_time ? (
                  <p className="text-[11px] font-bold text-accent">
                    {formatSittingTime(sitting.event_time)}
                  </p>
                ) : (
                  <p className="text-[11px] text-foreground/25">TBD</p>
                )}
                {sitting.event_date && sitting.event_date !== today && (
                  <p className="text-[9px] text-foreground/30 mt-0.5">
                    {new Date(`${sitting.event_date}T00:00:00`).toLocaleDateString("en-JM", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              <div className="mt-1 h-full w-px bg-foreground/[0.06] shrink-0 self-stretch" />

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-foreground/70 line-clamp-1 group-hover:text-foreground transition-colors">
                  {sitting.title || sitting.case_number || "Untitled Sitting"}
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {sitting.judge_name && (
                    <div className="flex items-center gap-1 text-[10px] text-foreground/35">
                      <User className="h-2.5 w-2.5" />
                      <span className="truncate max-w-[100px]">{sitting.judge_name}</span>
                    </div>
                  )}
                  {sitting.court_division && (
                    <div className="flex items-center gap-1 text-[10px] text-foreground/35">
                      <Building2 className="h-2.5 w-2.5" />
                      <span className="truncate max-w-[100px]">{sitting.court_division}</span>
                    </div>
                  )}
                </div>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-foreground/[0.15] group-hover:text-foreground/50 transition-colors" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden flex flex-col items-center justify-center rounded-lg border border-border bg-card py-12 text-center px-6">
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-heading font-bold text-[6rem] text-foreground/[0.02] select-none">
            NONE
          </span>
          <div className="relative z-10">
            <div className="mb-3 mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
              <Calendar className="h-5 w-5 text-foreground/20" />
            </div>
            <p className="text-sm font-medium text-foreground/40">
              No sittings scheduled
            </p>
            <p className="mt-1 text-xs text-foreground/25">
              Court lists are updated daily.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

export default function Dashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [latestJudgments, setLatestJudgments] = useState<Judgment[]>([]);
  const [trackedCases, setTrackedCases] = useState<UserCase[]>([]);
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [allJudgments, setAllJudgments] = useState<Judgment[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [welcomeNotif, setWelcomeNotif] = useState<Notification | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Jamaica" });
      const [judgmentsRes, casesRes, sittingsRes, userRes, notifsRes] =
        await Promise.all([
          apiClient.getJudgments(),
          apiClient.getUserCases(),
          apiClient.getCourtSittings({ date_from: todayStr, limit: 20 }),
          apiClient.getMe(),
          apiClient.getNotifications(),
        ]);
      setUser(userRes);
      setAllJudgments(judgmentsRes.judgments);
      setLatestJudgments(judgmentsRes.judgments.slice(0, 6));
      setTrackedCases(casesRes.cases);
      setSittings(sittingsRes.sittings);
      setAnnouncements(
        notifsRes.notifications.filter(
          (n) => n.type === "announcement" && n.read_at === null,
        ),
      );
      const welcome = notifsRes.notifications.find(
        (n) => n.type === "welcome" && n.read_at === null,
      );
      setWelcomeNotif(welcome ?? null);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDismissAnnouncement = useCallback(async (id: number) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    try {
      await apiClient.markNotificationRead(id);
    } catch {
      /* swallow */
    }
  }, []);

  const handleUntrack = useCallback(async (rowId: number) => {
    try {
      await apiClient.removeUserCaseByRow(rowId);
      setTrackedCases((prev) => prev.filter((c) => c.id !== rowId));
    } catch (err) {
      console.error("Failed to untrack case:", err);
    }
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySittingsCount = sittings.filter((s) => s.event_date === todayStr).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-16">
        {announcements
          .filter((n) => !dismissedIds.has(n.id))
          .map((n) => (
            <AnnouncementBanner
              key={n.id}
              notif={n}
              onDismiss={() => handleDismissAnnouncement(n.id)}
            />
          ))}

        {/* ── Hero greeting ─────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-8 bg-primary/45" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary/65">
              CourtWatch JA
            </span>
          </div>
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-foreground/40 mb-1">
            {getGreeting()}
          </p>
          <h1 className="font-heading font-bold leading-none tracking-tight text-foreground text-[3rem] sm:text-[4rem] lg:text-[5rem]">
            {user?.display_name || "Counsellor"}<span className="text-primary">.</span>
          </h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/30">
            {new Date().toLocaleDateString("en-JM", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <div className="mb-10 -mx-4 sm:mx-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-border rounded-lg overflow-hidden bg-card divide-x divide-border">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="px-6 py-6 space-y-3">
                  <Skeleton className="h-9 w-16 bg-foreground/[0.05]" />
                  <Skeleton className="h-2 w-20 bg-foreground/[0.04]" />
                </div>
              ))
            ) : (
              <>
                <div className="relative px-5 sm:px-6 py-6">
                  <div className="absolute top-0 left-5 sm:left-6 right-5 sm:right-6 h-[1.5px] bg-primary/60" />
                  <p className="font-heading font-bold text-[2.2rem] sm:text-[2.5rem] text-foreground leading-none tabular-nums">
                    {allJudgments.length}+
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/30">
                    Judgments
                  </p>
                </div>
                <div className="px-5 sm:px-6 py-6">
                  <p className="font-heading font-bold text-[2.2rem] sm:text-[2.5rem] text-foreground leading-none tabular-nums">
                    {trackedCases.length}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/30">
                    Tracked
                  </p>
                </div>
                <div className="px-5 sm:px-6 py-6">
                  <p className="font-heading font-bold text-[2.2rem] sm:text-[2.5rem] text-foreground leading-none tabular-nums">
                    {todaySittingsCount}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/30">
                    Today
                  </p>
                </div>
                <div className="px-5 sm:px-6 py-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="font-heading font-bold text-[1.4rem] text-primary leading-none">
                      Live
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/30">
                    Updates
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Track a Case ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-8 bg-accent/45" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/65">
              Track a Case
            </span>
          </div>
          <AddByNumberForm onRefresh={fetchData} />
        </div>

        {/* ── Judgment carousel ─────────────────────────────────────────── */}
        <div className="mb-8 carousel-container group">
          {loading ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-3 w-28 bg-foreground/[0.05]" />
                <Skeleton className="h-3 w-20 bg-foreground/[0.04]" />
              </div>
              <Skeleton className="h-[168px] sm:h-[200px] rounded-lg bg-foreground/[0.04]" />
            </div>
          ) : (
            <JudgmentCarousel judgments={latestJudgments} />
          )}
        </div>

        {/* ── Docket + Sittings ─────────────────────────────────────────── */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <DocketSection
            trackedCases={trackedCases}
            judgments={allJudgments}
            sittings={sittings}
            loading={loading}
            onUntrack={handleUntrack}
            onRefresh={fetchData}
          />
          <TodaySittings sittings={sittings} loading={loading} />
        </div>

        <LegalPulse />
      </main>

      {welcomeNotif && (
        <WelcomeGuide
          notificationId={welcomeNotif.id}
          onClose={() => setWelcomeNotif(null)}
        />
      )}
    </div>
  );
}
