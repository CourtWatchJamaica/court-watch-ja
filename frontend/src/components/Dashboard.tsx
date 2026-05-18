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
  FileText,
  TrendingUp,
  Scale,
  Calendar,
  Building2,
  User,
  ArrowUpRight,
  Megaphone,
  X,
} from "lucide-react";
import { VerdictIcon } from "@/components/icons";
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
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#FED100]/25 bg-[#FED100]/[0.05] px-4 py-3.5">
      <Megaphone className="h-4 w-4 text-[#FED100] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {notif.title && (
          <p className="text-sm font-semibold text-[#FED100] leading-snug">
            {notif.title}
          </p>
        )}
        {notif.message && (
          <p className="mt-0.5 text-xs text-white/55 leading-relaxed">
            {notif.message}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-white/25 hover:text-white/60 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 shrink-0">
      <div className={`rounded-xl p-2.5 ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-none">{label}</p>
      </div>
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 shrink-0 min-w-[140px]">
      <Skeleton className="h-10 w-10 rounded-xl bg-white/[0.06]" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-10 bg-white/[0.06]" />
        <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
      </div>
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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#FED100]" />
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        </div>
        <button
          onClick={() => router.push("/court-sittings/today")}
          className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-[#FED100]/70 dark:hover:text-[#FED100] transition-colors"
        >
          View All
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl bg-muted" />
          ))}
        </div>
      ) : display.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {display.map((sitting) => (
            <div
              key={sitting.id}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer"
              onClick={() => router.push(`/cases/sittings/${sitting.id}`)}
            >
              <div className="shrink-0 text-center min-w-[44px]">
                {sitting.event_time ? (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-[#FED100]">
                    {formatSittingTime(sitting.event_time)}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/50">TBD</p>
                )}
                {sitting.event_date && sitting.event_date !== today && (
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                    {new Date(
                      `${sitting.event_date}T00:00:00`,
                    ).toLocaleDateString("en-JM", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              <div className="mt-1 h-full w-px bg-border shrink-0 self-stretch" />

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-foreground/80 line-clamp-1 group-hover:text-foreground transition-colors">
                  {sitting.title || sitting.case_number || "Untitled Sitting"}
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {sitting.judge_name && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <User className="h-2.5 w-2.5" />
                      <span className="truncate max-w-[100px]">
                        {sitting.judge_name}
                      </span>
                    </div>
                  )}
                  {sitting.court_division && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Building2 className="h-2.5 w-2.5" />
                      <span className="truncate max-w-[100px]">
                        {sitting.court_division}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-10 text-center px-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FED100]/[0.07] ring-1 ring-[#FED100]/15">
            <Calendar className="h-5 w-5 text-[#FED100]/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No sittings scheduled
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Court lists are updated daily.
          </p>
        </div>
      )}
    </section>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
      const [judgmentsRes, casesRes, sittingsRes, userRes, notifsRes] =
        await Promise.all([
          apiClient.getJudgments(),
          apiClient.getUserCases(),
          apiClient.getCourtSittings(),
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

        <div className="mb-7">
          <div className="mb-2.5 flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#009B3A]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
              CourtWatch JA
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {user?.display_name || "Counsellor"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-JM", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="mb-8 -mx-4 sm:mx-0">
          <div className="flex gap-3 overflow-x-auto px-4 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1">
            {loading ? (
              [1, 2, 3, 4].map((i) => <SkeletonStat key={i} />)
            ) : (
              <>
                <StatCard
                  label="Total Judgments"
                  value={`${allJudgments.length}+`}
                  icon={FileText}
                  iconBg="bg-[#009B3A]/15"
                  iconColor="text-[#009B3A]"
                />
                <StatCard
                  label="Tracked Cases"
                  value={trackedCases.length}
                  icon={VerdictIcon}
                  iconBg="bg-[#FED100]/12"
                  iconColor="text-[#FED100]"
                />
                <StatCard
                  label="Today's Sittings"
                  value={
                    sittings.filter(
                      (s) =>
                        s.event_date ===
                        new Date().toISOString().split("T")[0],
                    ).length
                  }
                  icon={Calendar}
                  iconBg="bg-blue-500/15"
                  iconColor="text-blue-400"
                />
                <StatCard
                  label="Live Updates"
                  value="Active"
                  icon={TrendingUp}
                  iconBg="bg-purple-500/15"
                  iconColor="text-purple-400"
                />
              </>
            )}
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="h-4 w-[3px] rounded-full bg-[#FED100]" />
            <Scale className="h-3.5 w-3.5 text-[#FED100]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FED100]">
              Track a Case
            </span>
          </div>
          <AddByNumberForm onRefresh={fetchData} />
        </div>

        <div className="mb-8 carousel-container group">
          {loading ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-32 bg-white/[0.06]" />
                <Skeleton className="h-3.5 w-24 bg-white/[0.04]" />
              </div>
              <Skeleton className="h-[168px] sm:h-[200px] rounded-2xl bg-white/[0.04]" />
            </div>
          ) : (
            <JudgmentCarousel judgments={latestJudgments} />
          )}
        </div>

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
