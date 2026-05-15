"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ParishCourtCase, ParishSummary } from "@/lib/types";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Lazy-load the 3D map component (heavy — only mounts when Analytics tab is active)
const JamaicaMap3D = dynamic(() => import("@/components/JamaicaMap3D"), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
  ),
});

// ── Offence categorisation ────────────────────────────────────────────────────

type Category = "Violent" | "Property" | "Drugs" | "Other";

const VIOLENT_KEYWORDS = [
  "murder", "attempted murder", "manslaughter",
  "assault", "ass ob", "ob harm", "o b harm", "bodily harm",
  "wounding", "unlawful wounding", "wounding with intent",
  "shooting", "stabbing", "arson",
  "robbery", "rape",
  "indecent assault", "gross indecen",
  "sexual", "grievous",
  "gun", "firearm", "ammunition",
  "threat", "threatening", "stone throwing", "abduction",
  "weapon", "prohibited weapon",
  "buggery",
  "sex with",
  "cruelty",
  "causing death",
  "g s a", "g b h", "s i w p u s",
];
const PROPERTY_KEYWORDS = [
  "larceny", "praedial larceny",
  "theft", "stealing", "receiving stolen",
  "burglary", "housebreaking", "breaking",
  "fraud", "forgery", "obtaining", "false pretences",
  "malicious destruction", "malicious", "mal dest", "ma dest",
  "toll evasion",
  "embezzlement", "forged", "uttering", "counterfeit",
  "identity information", "id information", "id info", "identity info",
  "access device",
];
const DRUG_KEYWORDS = [
  "ganja", "cannabis", "cocaine", "crack",
  "dangerous drug", "controlled substance",
  "possession of ganja", "possession of cocaine",
  "drug trafficking", "trafficking", "traffick",
  "cultivation",
  "export of", "import of",
];

function categorise(offence: string | null): Category {
  if (!offence) return "Other";
  const o = offence.toLowerCase().replace(/\./g, " ").replace(/\s{2,}/g, " ").trim();
  if (VIOLENT_KEYWORDS.some((k) => o.includes(k))) return "Violent";
  if (DRUG_KEYWORDS.some((k) => o.includes(k))) return "Drugs";
  if (PROPERTY_KEYWORDS.some((k) => o.includes(k))) return "Property";
  return "Other";
}

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
    color: "text-gray-400",
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
    <div className="flex rounded-2xl bg-black/30 border border-white/[0.06] p-1.5 gap-1.5 backdrop-blur-sm">
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
              : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]",
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
                active === id ? "text-white/60" : "text-white/25"
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
        for (const c of res.cases) counts[categorise(c.offence)] += 1;
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
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a00 100%)" }}
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
              <p className="text-sm text-white/40">
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
              <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
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
                      className={`rounded-2xl border p-4 text-left transition-all duration-200 min-h-[88px] ${
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
                <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
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
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {loading
                  ? "Loading…"
                  : `${total} case${total !== 1 ? "s" : ""}${hasFilters ? " matching filters" : ""}`}
              </p>
            </section>

            {/* Cases Feed */}
            <section ref={casesFeedRef}>
              <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
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
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] py-16 text-center">
                  <p className="text-white/30 text-sm">No cases match your filters.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cases.map((c) => {
                    const cat = categorise(c.offence);
                    const cfg = CATEGORY_CONFIG[cat];
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
                          <p className="text-xs text-white/40 truncate">
                            {c.offence ?? "—"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] border ${cfg.border} ${cfg.color} bg-transparent`}
                          >
                            {cat}
                          </Badge>
                          <span className="text-[10px] text-white/30 hidden sm:block">
                            {c.parish}
                          </span>
                          {statusLabel && (
                            <span className="text-[10px] text-white/25 hidden md:block">
                              {statusLabel}
                            </span>
                          )}
                          {c.week_of && (
                            <span className="text-[10px] text-white/20 hidden lg:block">
                              {c.week_of}
                            </span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-white/20 shrink-0" />
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
                <div className="h-[450px] w-full rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse flex items-center justify-center">
                  <p className="text-white/15 text-xs">Loading analytics…</p>
                </div>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 w-full rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse"
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
