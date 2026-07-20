"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ParishAnalytics, ParishCourtCase, ParishSummary } from "@/lib/types";
import AuthGuard from "@/components/AuthGuard";
import dynamic from "next/dynamic";
import {
  Search,
  X,
  MapPin,
  AlertTriangle,
  Home,
  Pill,
  Shield,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  BarChart3,
  List,
  Download,
  Trophy,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Lazy-load the 3D map component (heavy — only mounts when Analytics tab is active)
const JamaicaMap3D = dynamic(() => import("@/components/JamaicaMap3D"), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full rounded-lg bg-white/[0.03] border border-white/[0.05] animate-pulse" />
  ),
});

// ── Offence categorisation display config ─────────────────────────────────────
// The category itself is computed once, server-side, in
// backend/src/utils/offence_category.rs — this just maps it to a look.

type Category = "Violent" | "Property" | "Drugs" | "Other";

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  Violent: {
    label: "Violent",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    Icon: AlertTriangle,
  },
  Property: {
    label: "Property",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    Icon: Home,
  },
  Drugs: {
    label: "Drugs",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    Icon: Pill,
  },
  Other: {
    label: "Other",
    color: "text-gray-500",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    Icon: Shield,
  },
};

const STATUS_LABELS: Record<string, string> = {
  M: "Mention",
  H: "Hearing",
  T: "Trial",
  A: "Adjourned",
  C: "Committed",
  D: "Dismissed",
  P: "Plea",
  F: "Fine Paid",
  E: "Estreat",
};

const LIMIT = 50;

type ActiveTab = "cases" | "analytics";

// ── Tab Toggle ────────────────────────────────────────────────────────────────

function TabToggle({
  active,
  onChange,
}: {
  active: ActiveTab;
  onChange: (t: ActiveTab) => void;
}) {
  return (
    <div className="flex rounded-lg bg-black/30 border border-white/[0.06] p-1.5 gap-1.5 backdrop-blur-sm">
      {(
        [
          { id: "cases" as ActiveTab,     icon: List,       label: "Cases",     sub: "Case feed" },
          { id: "analytics" as ActiveTab, icon: BarChart3,  label: "Analytics", sub: "3D parish map" },
        ] as const
      ).map(({ id, icon: Icon, label, sub }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            "flex flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-3",
            "transition-all duration-200 active:scale-[0.97]",
            active === id
              ? "bg-[#CD7F32] text-white shadow-[0_4px_20px_rgba(205,127,50,0.35)]"
              : "text-white/70 hover:text-white/90 hover:bg-white/[0.04]",
          ].join(" ")}
        >
          <Icon
            className="h-4 w-4 shrink-0"
            strokeWidth={active === id ? 2.2 : 1.8}
          />
          <div className="text-left hidden sm:block">
            <p className="text-[14px] font-semibold leading-none">{label}</p>
            <p
              className={`mt-0.5 text-[10px] leading-none ${
                active === id ? "text-white/60" : "text-white/55"
              }`}
            >
              {sub}
            </p>
          </div>
          <span className="text-[14px] font-semibold sm:hidden">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Journalist insights ──────────────────────────────────────────────────────

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-JM", {
    month: "short",
    day: "numeric",
  });
}

function InsightsPanel({
  insights,
  loading,
  onParishClick,
}: {
  insights: ParishAnalytics | null;
  loading: boolean;
  onParishClick: (parish: string) => void;
}) {
  if (loading && !insights) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-lg bg-white/[0.03] border border-white/[0.05] animate-pulse" />
        ))}
      </div>
    );
  }
  if (!insights) return null;

  const { leaderboard, spikes, backlog } = insights;
  const maxCount = Math.max(1, ...leaderboard.map((r) => r.count));
  const flaggedSpikes = spikes.filter((s) => s.is_spike);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Most-Charged Offences */}
      <section className="rounded-lg border border-white/[0.06] bg-black/25 p-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
          <Trophy className="h-3.5 w-3.5 text-[#CD7F32]" />
          Most-Charged Offences
        </h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-white/50">No data yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {leaderboard.map((row, i) => {
              const cfg = CATEGORY_CONFIG[row.category];
              return (
                <li key={`${row.offence}-${i}`} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-[11px] font-semibold text-white/40 tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12.5px] text-white/85 truncate">{row.offence}</span>
                      <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${cfg.color}`}>
                        {row.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.color.replace("text-", "bg-")}`}
                        style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Spike Alerts */}
      <section className="rounded-lg border border-white/[0.06] bg-black/25 p-5">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
          <TrendingUp className="h-3.5 w-3.5 text-[#CD7F32]" />
          Week-over-Week Spikes
        </h2>
        {flaggedSpikes.length === 0 ? (
          <p className="text-sm text-white/50">No unusual case-volume jumps flagged this week.</p>
        ) : (
          <ul className="space-y-2">
            {flaggedSpikes
              .sort((a, b) => b.pct_change - a.pct_change)
              .map((s) => (
                <li key={s.parish}>
                  <button
                    onClick={() => onParishClick(s.parish)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-left hover:bg-amber-500/[0.1] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-white/90">{s.parish}</p>
                      <p className="text-[11px] text-white/55">
                        {s.previous_count} → {s.current_count} cases ·{" "}
                        {formatShortDate(s.previous_week)} to {formatShortDate(s.current_week)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-amber-400 tabular-nums">
                      +{s.pct_change.toFixed(0)}%
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Backlog Watch */}
      <section className="rounded-lg border border-white/[0.06] bg-black/25 p-5 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
          <Clock className="h-3.5 w-3.5 text-[#CD7F32]" />
          Backlog Watch — Charges Recurring Across Weeks
        </h2>
        <p className="text-[11px] text-white/45 -mt-2.5 mb-4">
          Same accused, parish, and offence appearing in 2+ separate weekly cause lists —
          a status-code-independent signal a charge hasn&apos;t resolved.
        </p>

        {backlog.by_parish.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {backlog.by_parish.map((p) => (
              <button
                key={p.parish}
                onClick={() => onParishClick(p.parish)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-white/65 hover:text-white/85 hover:border-white/[0.15] transition-colors"
              >
                {p.parish} <span className="text-[#CD7F32] font-semibold">{p.flagged_count}</span>
              </button>
            ))}
          </div>
        )}

        {backlog.top.length === 0 ? (
          <p className="text-sm text-white/50">No charges recurring across 2+ weekly lists.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-white/45 text-[10px] uppercase tracking-wider">
                  <th className="px-1 pb-2 font-semibold">Accused</th>
                  <th className="px-1 pb-2 font-semibold">Offence</th>
                  <th className="px-1 pb-2 font-semibold">Parish</th>
                  <th className="px-1 pb-2 font-semibold text-right">Weeks Listed</th>
                  <th className="px-1 pb-2 font-semibold hidden sm:table-cell">First seen</th>
                </tr>
              </thead>
              <tbody>
                {backlog.top.map((row, i) => (
                  <tr key={i} className="border-t border-white/[0.05]">
                    <td className="px-1 py-2 text-white/85 whitespace-nowrap">{row.accused_name}</td>
                    <td className="px-1 py-2 text-white/65 max-w-[220px] truncate">{row.offence}</td>
                    <td className="px-1 py-2 text-white/55 whitespace-nowrap">{row.parish}</td>
                    <td className="px-1 py-2 text-right font-semibold text-amber-400 tabular-nums">
                      {row.appearance_count}
                    </td>
                    <td className="px-1 py-2 text-white/50 hidden sm:table-cell whitespace-nowrap">
                      {row.first_seen ? formatShortDate(row.first_seen) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function ParishCourtDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab]             = useState<ActiveTab>("cases");
  const [cases, setCases]                     = useState<ParishCourtCase[]>([]);
  const [total, setTotal]                     = useState(0);
  const [page, setPage]                       = useState(1);
  const [summary, setSummary]                 = useState<ParishSummary[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory]   = useState<Category | null>(null);
  const [selectedParish, setSelectedParish]   = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts]   = useState<Record<Category, number>>(
    { Violent: 0, Property: 0, Drugs: 0, Other: 0 },
  );

  // Analytics data — lazy-loaded once on first analytics tab open
  const [analyticsCases, setAnalyticsCases]     = useState<ParishCourtCase[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsLoadedRef                      = useRef(false);

  // Journalist insights (leaderboard / spikes / backlog) — lazy-loaded once too
  const [insights, setInsights]               = useState<ParishAnalytics | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const insightsLoadedRef                     = useRef(false);

  // Auto-scroll to cases feed when the user taps a filter (mobile only)
  const casesFeedRef    = useRef<HTMLElement>(null);
  const isFirstRender   = useRef(true);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Reset page when any filter changes ──────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [selectedParish, activeCategory, debouncedSearch]);

  // ── Summary (parish card totals) ────────────────────────────────────────────
  useEffect(() => {
    apiClient.getParishSummary()
      .then((res) => setSummary(res.summary))
      .catch(() => {});
  }, []);

  // ── Category counts — parish-scoped ─────────────────────────────────────────
  useEffect(() => {
    apiClient
      .getParishCases({
        limit: 5000,
        ...(selectedParish ? { parish: selectedParish } : {}),
      })
      .then((res) => {
        const counts: Record<Category, number> = {
          Violent: 0, Property: 0, Drugs: 0, Other: 0,
        };
        for (const c of res.cases) counts[c.category] += 1;
        setCategoryCounts(counts);
      })
      .catch(() => {});
  }, [selectedParish]);

  // ── Analytics data (lazy, once) ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "analytics" || analyticsLoadedRef.current) return;
    analyticsLoadedRef.current = true;
    setAnalyticsLoading(true);
    apiClient
      .getParishCases({ limit: 5000 })
      .then((res) => setAnalyticsCases(res.cases))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab]);

  // ── Journalist insights (lazy, once) ────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "analytics" || insightsLoadedRef.current) return;
    insightsLoadedRef.current = true;
    setInsightsLoading(true);
    apiClient
      .getParishAnalytics()
      .then(setInsights)
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
  }, [activeTab]);

  // ── Main paginated fetch ────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiClient
      .getParishCases({
        limit: LIMIT,
        page,
        ...(selectedParish ? { parish: selectedParish } : {}),
        ...(activeCategory ? { category: activeCategory } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
      })
      .then((res) => {
        if (!active) return;
        setCases(
          [...res.cases].sort(
            (a, b) => (b.week_of ?? "").localeCompare(a.week_of ?? ""),
          ),
        );
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, selectedParish, activeCategory, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory(null);
    setSelectedParish(null);
    setPage(1);
  }, []);

  const hasFilters = search || activeCategory || selectedParish;

  // Scroll to the cases feed on filter tap — skip first render and desktop
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      casesFeedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeCategory, selectedParish]);

  // When map click → switch to cases tab with parish pre-selected
  const handleMapParishClick = useCallback((parish: string) => {
    setSelectedParish(parish);
    setActiveTab("cases");
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#080810" }}
    >
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.push("/cases")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-4 py-2.5 mb-4 text-[13px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/40 active:scale-[0.97] transition-all duration-150 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-[#CD7F32]/30"
              style={{ background: "rgba(205,127,50,0.12)" }}
            >
              <MapPin className="h-5 w-5" style={{ color: "#CD7F32" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Parish Court
              </h1>
              <p className="text-sm text-white/70">
                Jamaica&apos;s 14 Parishes · {total} case{total !== 1 ? "s" : ""} indexed
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 md:pb-10">

        {/* ── Tab Toggle ─────────────────────────────────────────────────────── */}
        <TabToggle active={activeTab} onChange={setActiveTab} />

        {/* ══════════════════════════════════════════════════════════════════════
            CASES TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "cases" && (
          <>
            {/* Offence Breakdown Cards */}
            <section>
              <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">
                Offence Breakdown
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["Violent", "Property", "Drugs", "Other"] as Category[]).map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const active = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(active ? null : cat)}
                      className={`rounded-lg border p-4 text-left transition-all duration-200 min-h-[88px] ${
                        active
                          ? `${cfg.bg} ${cfg.border} ring-1 ${cfg.border.replace("border-", "ring-")}`
                          : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className={`flex items-center gap-2 mb-2 ${active ? cfg.color : "text-white/50"}`}>
                        <cfg.Icon className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          {cfg.label}
                        </span>
                      </div>
                      <p className={`text-3xl font-bold ${active ? cfg.color : "text-white"}`}>
                        {loading && categoryCounts[cat] === 0 ? "—" : categoryCounts[cat]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Parish Grid */}
            {summary.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">
                  By Parish
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {summary.map((p) => {
                    const active = selectedParish === p.name;
                    return (
                      <button
                        key={p.name}
                        onClick={() => setSelectedParish(active ? null : p.name)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-200 min-h-[56px] ${
                          active
                            ? "border-[#CD7F32]/50 bg-[#CD7F32]/10 ring-1 ring-[#CD7F32]/30"
                            : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <p
                          className={`text-[11px] font-semibold truncate ${
                            active ? "text-[#CD7F32]" : "text-white/60"
                          }`}
                        >
                          {p.name}
                        </p>
                        <p className={`text-lg font-bold ${active ? "text-[#CD7F32]" : "text-white"}`}>
                          {p.total_cases}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Search + Filter bar */}
            <section>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search accused, offence, or parish…"
                    className="w-full rounded-xl border border-border bg-card pl-10 pr-10 py-3 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#CD7F32]/50 focus:ring-1 focus:ring-[#CD7F32]/25 transition-colors"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Clear all
                  </button>
                )}
                <a
                  href={apiClient.getParishExportUrl({
                    ...(selectedParish ? { parish: selectedParish } : {}),
                    ...(activeCategory ? { category: activeCategory } : {}),
                    ...(debouncedSearch ? { q: debouncedSearch } : {}),
                  })}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-3.5 py-2.5 text-[12px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/40 active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
                  title="Export the current filtered case list as CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </a>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {loading
                  ? "Loading…"
                  : `${total} case${total !== 1 ? "s" : ""}${hasFilters ? " matching filters" : ""}`}
              </p>
            </section>

            {/* Cases Feed */}
            <section ref={casesFeedRef}>
              <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">
                Cases
              </h2>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl bg-white/[0.03] border border-white/[0.05] animate-pulse"
                    />
                  ))}
                </div>
              ) : cases.length === 0 ? (
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] py-16 text-center">
                  <p className="text-white/60 text-sm">No cases match your filters.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cases.map((c) => {
                    const cfg = CATEGORY_CONFIG[c.category];
                    const statusLabel = c.status ? STATUS_LABELS[c.status] ?? c.status : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/parish-court/${c.id}`)}
                        className="w-full flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.07] hover:border-white/[0.10] active:scale-[0.99] transition-all duration-150 min-h-[56px]"
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.color.replace("text-", "bg-")}`} />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {c.accused_name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-white/70 truncate">
                            {c.offence ?? "—"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] border ${cfg.border} ${cfg.color} bg-transparent`}
                          >
                            {c.category}
                          </Badge>
                          <span className="text-[10px] text-white/60 hidden sm:block">
                            {c.parish}
                          </span>
                          {statusLabel && (
                            <span className="text-[10px] text-white/55 hidden md:block">
                              {statusLabel}
                            </span>
                          )}
                          {c.week_of && (
                            <span className="text-[10px] text-white/50 hidden lg:block">
                              {c.week_of}
                            </span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-white/50 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pagination controls */}
              {!loading && total > LIMIT && (
                <div className="mt-6 flex items-center justify-between gap-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-4 py-2.5 text-[13px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/40 active:scale-[0.97] transition-all duration-150 min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#CD7F32]/10 disabled:active:scale-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <span className="text-sm text-foreground/60 tabular-nums">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-4 py-2.5 text-[13px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/40 active:scale-[0.97] transition-all duration-150 min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#CD7F32]/10 disabled:active:scale-100"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ANALYTICS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <section className="space-y-2">
            {analyticsLoading && analyticsCases.length === 0 ? (
              <div className="space-y-4">
                <div className="h-[450px] w-full rounded-lg bg-white/[0.03] border border-white/[0.05] animate-pulse flex items-center justify-center">
                  <p className="text-white/15 text-xs">Loading analytics…</p>
                </div>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 w-full rounded-lg bg-white/[0.03] border border-white/[0.05] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <JamaicaMap3D
                summary={summary}
                analyticsCases={analyticsCases}
                selectedParish={selectedParish}
                onParishClick={handleMapParishClick}
              />
            )}

            <InsightsPanel
              insights={insights}
              loading={insightsLoading}
              onParishClick={handleMapParishClick}
            />
          </section>
        )}

      </div>
    </div>
  );
}

export default function ParishCourtPage() {
  return (
    <AuthGuard>
      <ParishCourtDashboard />
    </AuthGuard>
  );
}
