"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import CaseCard from "@/components/CaseCard";
import { apiClient } from "@/lib/api";
import { CoJudge, CourtSitting, Judge, Judgment } from "@/lib/types";
import { formatDateOnly, todayJamaica } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Scale,
  FileText,
  Hash,
  CalendarDays,
  Calendar,
  Clock,
  Users,
  Search,
  Gavel,
  History,
} from "lucide-react";

/* ── Helpers ── */

function fmtMonthYear(d: string | null | undefined): string {
  return formatDateOnly(d, { month: "short", year: "numeric" });
}

function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return null;
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

/* ── Skeletons ── */

function SkeletonHeader() {
  return (
    <div className="animate-pulse mb-10">
      <div className="h-3 w-24 rounded bg-muted mb-6" />
      <div className="flex items-start gap-5">
        <div className="h-16 w-16 rounded-2xl bg-muted shrink-0" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-3.5 w-1/3 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 flex-1 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="mt-8 h-px bg-muted" />
      <div className="mt-6 h-4 w-40 rounded bg-muted" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex justify-between gap-3">
        <div className="h-3.5 w-2/3 rounded bg-muted" />
        <div className="h-5 w-20 rounded-md bg-muted shrink-0" />
      </div>
      <div className="space-y-2 pt-1">
        <div className="h-2.5 w-1/2 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}

/* ── Stat item ── */

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-[#009B3A]/70" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-[13px] font-semibold text-foreground leading-none truncate">{value}</p>
      </div>
    </div>
  );
}

/* ── Activity-by-year mini chart ── */

function YearActivityChart({ judgments }: { judgments: Judgment[] }) {
  const years = useMemo(() => {
    const counts = new Map<number, number>();
    for (const j of judgments) {
      if (!j.date) continue;
      const y = parseInt(j.date.slice(0, 4), 10);
      if (!Number.isNaN(y)) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    const sorted = [...counts.keys()].sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    // Fill gap years with 0 so the timeline reads continuously.
    const out: Array<{ year: number; count: number }> = [];
    for (let y = sorted[0]; y <= sorted[sorted.length - 1]; y++) {
      out.push({ year: y, count: counts.get(y) ?? 0 });
    }
    return out;
  }, [judgments]);

  if (years.length < 2) return null;
  const max = Math.max(1, ...years.map((y) => y.count));

  return (
    <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Judgments per year
      </p>
      <div className="flex items-end gap-1.5 h-14">
        {years.map(({ year, count }) => (
          <div
            key={year}
            className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-0"
            title={`${year}: ${count} judgment${count !== 1 ? "s" : ""}`}
          >
            <span className="mb-0.5 hidden text-[9px] text-muted-foreground leading-none group-hover:block">
              {count}
            </span>
            <div
              className="w-full max-w-[26px] rounded-t bg-[#009B3A]/70 group-hover:bg-[#009B3A] transition-colors"
              style={{ height: `${Math.max(count > 0 ? 8 : 2, (count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
        <span>{years[0].year}</span>
        <span>{years[years.length - 1].year}</span>
      </div>
    </div>
  );
}

/* ── Division breakdown chips ── */

function DivisionChips({ sittings }: { sittings: CourtSitting[] }) {
  const divisions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sittings) {
      if (!s.court_division) continue;
      counts.set(s.court_division, (counts.get(s.court_division) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [sittings]);

  if (divisions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground">Sits in:</span>
      {divisions.map(([division, count]) => (
        <span
          key={division}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground/80"
        >
          <Gavel className="h-3 w-3 text-[#009B3A]/70" />
          {division}
          <span className="text-muted-foreground">{count}</span>
        </span>
      ))}
    </div>
  );
}

/* ── "Frequently sits with" chips ── */

function CoJudgeChips({ coJudges }: { coJudges: CoJudge[] }) {
  const router = useRouter();
  if (coJudges.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-[#009B3A]" />
        <h2 className="text-sm font-semibold">Frequently Sits With</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {coJudges.map((cj) => (
          <button
            key={cj.id}
            onClick={() => router.push(`/judges/${cj.id}`)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground/85 hover:border-[#009B3A]/40 hover:text-foreground transition-colors"
          >
            <Scale className="h-3 w-3 text-[#009B3A]/70" />
            {cj.name}
            <span className="rounded-full bg-[#009B3A]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#009B3A]">
              {cj.shared_cases}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Number shows how many cases they appeared on together
      </p>
      <div className="mt-6 h-px bg-border" />
    </div>
  );
}

/* ── Sitting row (shared by upcoming + history) ── */

function SittingRow({
  sitting,
  accent,
}: {
  sitting: CourtSitting;
  accent: "upcoming" | "past";
}) {
  const router = useRouter();
  const iconColor = accent === "upcoming" ? "text-[#FED100]/60" : "text-muted-foreground/50";
  return (
    <button
      onClick={() => router.push(`/cases/sittings/${sitting.id}`)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-[#009B3A]/30 transition-colors"
    >
      <div className="shrink-0 pt-0.5">
        <Clock className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground/80 line-clamp-1">
          {sitting.title || sitting.case_number || "Sitting"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>
            {sitting.event_date
              ? formatDateOnly(sitting.event_date, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Date not published"}
          </span>
          {fmtTime(sitting.event_time) && <span>{fmtTime(sitting.event_time)}</span>}
          {sitting.court_division && <span>{sitting.court_division}</span>}
          {sitting.event_type && <span className="capitalize">{sitting.event_type}</span>}
        </div>
      </div>
    </button>
  );
}

/* ── Page ── */

const HISTORY_PREVIEW = 6;

export default function JudgeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [judge, setJudge] = useState<Judge | null>(null);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [coJudges, setCoJudges] = useState<CoJudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [judgmentSearch, setJudgmentSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    apiClient
      .getJudge(id)
      .then((data) => {
        setJudge(data.judge);
        setJudgments(data.judgments);
        setSittings(data.sittings ?? []);
        setCoJudges(data.co_judges ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const today = todayJamaica();

  const upcomingSittings = useMemo(
    () =>
      sittings
        .filter((s) => (s.event_date ?? "") >= today)
        .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")),
    [sittings, today],
  );

  const pastSittings = useMemo(
    () => sittings.filter((s) => !s.event_date || s.event_date < today),
    [sittings, today],
  );

  /* Sorted newest-first by the API; first = newest, last = oldest */
  const newestDate = judgments[0]?.date ?? null;
  const oldestDate = judgments[judgments.length - 1]?.date ?? null;

  const judgmentYears = useMemo(() => {
    const years = new Set<string>();
    for (const j of judgments) {
      if (j.date) years.add(j.date.slice(0, 4));
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [judgments]);

  const visibleJudgments = useMemo(() => {
    const q = judgmentSearch.trim().toLowerCase();
    return judgments.filter((j) => {
      if (yearFilter !== "all" && (j.date ?? "").slice(0, 4) !== yearFilter) {
        return false;
      }
      if (!q) return true;
      return (
        j.case_number.toLowerCase().includes(q) ||
        (j.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [judgments, judgmentSearch, yearFilter]);

  const visibleHistory = showAllHistory
    ? pastSittings
    : pastSittings.slice(0, HISTORY_PREVIEW);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">
          {loading ? (
            <>
              <SkeletonHeader />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </>
          ) : notFound || !judge ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Scale className="mb-4 h-12 w-12 text-muted-foreground/25" />
              <p className="text-lg font-semibold mb-1">Judge not found</p>
              <p className="text-sm text-muted-foreground mb-6">
                This judge could not be found in the registry.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/judges")}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to Judges
              </Button>
            </div>
          ) : (
            <>
              {/* Back */}
              <button
                onClick={() => router.back()}
                className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              {/* Judge header */}
              <div className="mb-6">
                <div className="flex items-start gap-5 mb-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
                    <Scale className="h-8 w-8 text-[#009B3A]" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                        Judge Profile
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {judge.name}
                    </h1>
                    {judge.court && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 text-[#009B3A]/70" />
                        {judge.court}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Stat bar ── */}
                <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                  <StatItem
                    icon={Hash}
                    label="Judgments"
                    value={judge.total_cases ?? judgments.length}
                  />
                  <StatItem icon={Calendar} label="Sittings" value={sittings.length} />
                  <StatItem
                    icon={CalendarDays}
                    label="First Judgment"
                    value={fmtMonthYear(oldestDate)}
                  />
                  <StatItem
                    icon={CalendarDays}
                    label="Last Judgment"
                    value={fmtMonthYear(newestDate)}
                  />
                </div>

                <YearActivityChart judgments={judgments} />
                <DivisionChips sittings={sittings} />
              </div>

              <div className="mb-6 h-px bg-border" />

              <CoJudgeChips coJudges={coJudges} />

              {/* Upcoming Sittings */}
              {upcomingSittings.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#FED100]" />
                    <h2 className="text-sm font-semibold">
                      Upcoming Sittings
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({upcomingSittings.length})
                      </span>
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {upcomingSittings.map((s) => (
                      <SittingRow key={s.id} sitting={s} accent="upcoming" />
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Per published court lists — sittings can be rescheduled by the court
                  </p>
                  <div className="mt-6 h-px bg-border" />
                </div>
              )}

              {/* Sitting history */}
              {pastSittings.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <History className="h-4 w-4 text-[#009B3A]" />
                    <h2 className="text-sm font-semibold">
                      Sitting History
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({pastSittings.length})
                      </span>
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {visibleHistory.map((s) => (
                      <SittingRow key={s.id} sitting={s} accent="past" />
                    ))}
                  </div>
                  {pastSittings.length > HISTORY_PREVIEW && (
                    <button
                      onClick={() => setShowAllHistory((v) => !v)}
                      className="mt-3 text-[12px] font-medium text-[#009B3A] hover:underline"
                    >
                      {showAllHistory
                        ? "Show less"
                        : `Show all ${pastSittings.length} sittings`}
                    </button>
                  )}
                  <div className="mt-6 h-px bg-border" />
                </div>
              )}

              {/* Judgments */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#009B3A]" />
                  <h2 className="text-sm font-semibold">
                    Judgments
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({visibleJudgments.length}
                      {visibleJudgments.length !== judgments.length
                        ? ` of ${judgments.length}`
                        : ""})
                    </span>
                  </h2>
                </div>
              </div>

              {judgments.length > 0 && (
                <div className="mb-5 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={judgmentSearch}
                      onChange={(e) => setJudgmentSearch(e.target.value)}
                      placeholder="Search this judge's cases by number or title…"
                      className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#009B3A]/50 focus:ring-1 focus:ring-[#009B3A]/25 transition-colors"
                    />
                  </div>
                  {judgmentYears.length > 1 && (
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[#009B3A]/50"
                    >
                      <option value="all">All years</option>
                      {judgmentYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {visibleJudgments.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {visibleJudgments.map((judgment) => (
                    <CaseCard
                      key={judgment.id}
                      judgment={judgment}
                      onClick={() => router.push(`/cases/${judgment.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/50 py-16 text-center">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">
                    {judgments.length === 0
                      ? "No judgments on record for this judge"
                      : "No judgments match your filters"}
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
