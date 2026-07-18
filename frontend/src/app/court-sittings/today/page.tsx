"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import SittingCard from "@/components/SittingCard";
import { apiClient } from "@/lib/api";
import type { CourtSitting, ParishCourtCase } from "@/lib/types";
import { useTracking } from "@/lib/tracking-context";
import { ArrowLeft, Calendar, Scale, Building2, Gavel, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ────────────────────────────────────────────────────────────────────

type CourtGroup = "Supreme Court" | "Court of Appeal" | "Parish Court";

const COURT_ORDER: CourtGroup[] = ["Supreme Court", "Court of Appeal", "Parish Court"];

const COURT_CONFIG: Record<
  CourtGroup,
  { label: string; Icon: React.ComponentType<{ className?: string }>; accent: string; bg: string; pill: string }
> = {
  "Supreme Court": {
    label: "Supreme Court",
    Icon: Scale,
    accent: "text-[#009B3A]",
    bg: "bg-[#009B3A]/10",
    pill: "border-[#009B3A]/30 text-[#009B3A] bg-[#009B3A]/10",
  },
  "Court of Appeal": {
    label: "Court of Appeal",
    Icon: Gavel,
    accent: "text-[#FED100]",
    bg: "bg-[#FED100]/10",
    pill: "border-[#FED100]/30 text-[#FED100] bg-[#FED100]/10",
  },
  "Parish Court": {
    label: "Parish Court",
    Icon: Building2,
    accent: "text-[#CD7F32]",
    bg: "bg-[#CD7F32]/10",
    pill: "border-[#CD7F32]/30 text-[#CD7F32] bg-[#CD7F32]/10",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekMonday(): string {
  const str = new Date().toLocaleDateString("en-CA");
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().split("T")[0];
}

function adaptParishCase(c: ParishCourtCase): CourtSitting {
  const isCivil = c.case_type === "civil";
  const title = isCivil
    ? `${c.accused_name ?? "Unknown"} v ${c.offence ?? "Unknown"} — ${c.parish} Parish Court`
    : c.accused_name
    ? `${c.accused_name} — ${c.parish} Parish Court`
    : `${c.parish} Parish Court`;
  return {
    id: c.id,
    case_number: null,
    title,
    judge_name: null,
    court_division: "Parish Court",
    event_type: c.status ?? null,
    event_date: c.week_of ?? null,
    event_time: null,
    lawyers: null,
    pdf_source_url: c.pdf_source_url ?? null,
    created_at: c.created_at,
    snippet: isCivil ? null : (c.offence ?? null),
    _source: "parish",
  };
}

function classifyCourtDivision(division: string | null): CourtGroup {
  if (!division) return "Supreme Court";
  const d = division.toLowerCase();
  if (d.includes("appeal")) return "Court of Appeal";
  if (d.includes("parish")) return "Parish Court";
  return "Supreme Court";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-48 bg-white/[0.06]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0e0e1a] p-4 space-y-3">
            <Skeleton className="h-3.5 w-2/3 bg-white/[0.06]" />
            <Skeleton className="h-2.5 w-1/2 bg-white/[0.04]" />
            <Skeleton className="h-2.5 w-1/3 bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

function TodaySittingsPage() {
  const router = useRouter();
  const { isTracked, track, untrack } = useTracking();
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [parishSittings, setParishSittings] = useState<CourtSitting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [courtFilter, setCourtFilter] = useState<CourtGroup | null>(null);

  const today = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-JM", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  useEffect(() => {
    const weekMonday = getWeekMonday();

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [sittingsRes, parishRes] = await Promise.allSettled([
          apiClient.getCourtSittings({ date_from: today, date_to: today, limit: 500 }),
          apiClient.getParishCases({ date_from: weekMonday, limit: 200 }),
        ]);

        if (sittingsRes.status === "fulfilled") {
          setSittings(sittingsRes.value.sittings);
        }
        if (parishRes.status === "fulfilled") {
          setParishSittings(parishRes.value.cases.map(adaptParishCase));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [today]);

  // Merge all sittings; parish rows are already tagged _source:"parish"
  const allSittings = useMemo(
    () => [...sittings, ...parishSittings],
    [sittings, parishSittings],
  );

  // Client-side search filter
  const displaySittings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSittings;
    return allSittings.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.case_number?.toLowerCase().includes(q) ||
        s.judge_name?.toLowerCase().includes(q) ||
        s.court_division?.toLowerCase().includes(q),
    );
  }, [allSittings, query]);

  // Group by court
  const grouped = useMemo(() => {
    const map: Record<CourtGroup, CourtSitting[]> = {
      "Supreme Court": [],
      "Court of Appeal": [],
      "Parish Court": [],
    };
    for (const s of displaySittings) {
      map[classifyCourtDivision(s.court_division)].push(s);
    }
    return map;
  }, [displaySittings]);

  // Which courts have raw data at all (before search filter)
  const courtHasData = useMemo(() => {
    const map: Record<CourtGroup, boolean> = {
      "Supreme Court": false,
      "Court of Appeal": false,
      "Parish Court": parishSittings.length > 0,
    };
    for (const s of sittings) {
      map[classifyCourtDivision(s.court_division)] = true;
    }
    return map;
  }, [sittings, parishSittings]);

  const visibleGroups = courtFilter ? [courtFilter] : COURT_ORDER;
  const totalCount = displaySittings.length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#080810" }}
    >
      {/* Header bar */}
      <div className="border-b border-white/[0.06] bg-black/30 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-[#FED100]/30 shrink-0"
              style={{ background: "rgba(254,209,0,0.10)" }}
            >
              <Calendar className="h-4 w-4" style={{ color: "#FED100" }} />
            </div>
            <div>
              <span className="text-sm font-semibold text-white/80">Today&apos;s Sittings</span>
              <p className="text-[10px] text-white/60 leading-none mt-0.5">{todayLabel}</p>
            </div>
          </div>
          {!loading && (
            <span className="text-[11px] font-medium text-white/60">
              {totalCount} sitting{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 space-y-6">
        {/* Back to Dashboard */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.97] transition-all duration-150 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/55 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, case number, judge, or division…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-11 pr-10 py-3 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-[#FED100]/30 focus:bg-white/[0.06] transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/55 hover:text-white/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Court filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCourtFilter(null)}
            className={`rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-colors ${
              courtFilter === null
                ? "border-white/30 bg-white/10 text-white/90"
                : "border-white/10 bg-transparent text-white/70 hover:text-white/90"
            }`}
          >
            All Courts
          </button>
          {COURT_ORDER.map((group) => {
            const cfg = COURT_CONFIG[group];
            return (
              <button
                key={group}
                onClick={() => setCourtFilter(courtFilter === group ? null : group)}
                className={`rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                  courtFilter === group
                    ? cfg.pill
                    : "border-white/10 bg-transparent text-white/70 hover:text-white/90"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-10">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        ) : (
          <div className="space-y-10">
            {visibleGroups.map((group) => {
              const cfg = COURT_CONFIG[group];
              const items = grouped[group];
              const hasData = courtHasData[group];
              const CfgIcon = cfg.Icon;

              return (
                <section key={group}>
                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${cfg.bg}`}>
                      <CfgIcon className={`h-4 w-4 ${cfg.accent}`} />
                    </div>
                    <div>
                      <h2 className={`text-sm font-bold ${cfg.accent}`}>{cfg.label}</h2>
                      <p className="text-[10px] text-white/60 leading-none mt-0.5">
                        {items.length} sitting{items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-white/[0.05] ml-2" />
                  </div>

                  {items.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((s) => (
                        <SittingCard
                          key={`${s._source ?? "sitting"}-${s.id}`}
                          sitting={s}
                          onClick={() =>
                            s._source === "parish"
                              ? router.push(`/parish-court/${s.id}`)
                              : router.push(`/cases/sittings/${s.id}`)
                          }
                          isTracked={s._source === "parish" ? false : isTracked(s.id, "sitting")}
                          onTrack={
                            s._source === "parish"
                              ? undefined
                              : (id) => (isTracked(id, "sitting") ? untrack(id) : track(id, "sitting"))
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.05] bg-black/20 py-10 text-center px-6">
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bg}`}>
                        <CfgIcon className={`h-5 w-5 ${cfg.accent} opacity-40`} />
                      </div>
                      <p className="text-sm font-semibold text-white/60">
                        {query
                          ? `No ${cfg.label} sittings match your search`
                          : hasData
                          ? `No ${cfg.label} sittings scheduled for today`
                          : `No ${cfg.label} sittings scheduled for today`}
                      </p>
                      {!query && !hasData && (
                        <p className="mt-1 text-xs text-white/50 max-w-[220px] leading-relaxed">
                          Court lists are updated daily. Check back soon.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function CourtSittingsTodayPage() {
  return (
    <AuthGuard>
      <TodaySittingsPage />
    </AuthGuard>
  );
}
