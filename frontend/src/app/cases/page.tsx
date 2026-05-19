"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import CaseCard from "@/components/CaseCard";
import SittingCard from "@/components/SittingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { Judgment, CourtSitting, ParishCourtCase } from "@/lib/types";
import { useTracking } from "@/lib/tracking-context";
import { SLUG_TO_COURT, COURT_TO_SLUG, type Court } from "@/lib/court-context";
import {
  Scale,
  Calendar,
  SearchX,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  SlidersHorizontal,
} from "lucide-react";

const LIMIT = 20;

type Tab = "judgments" | "sittings";

const COURTS = ["Supreme Court", "Court of Appeal", "Parish Court"] as const;

const TAG_OPTIONS = [
  { value: "tax_law",       label: "Tax Law" },
  { value: "constitutional", label: "Constitutional" },
  { value: "criminal",       label: "Criminal" },
  { value: "civil",          label: "Civil" },
  { value: "family",         label: "Family" },
  { value: "commercial",     label: "Commercial" },
  { value: "probate",        label: "Probate" },
  { value: "labour",         label: "Labour" },
] as const;

// ── Filter state ────────────────────────────────────────────────────────────

interface Filters {
  dateFrom: string;
  dateTo: string;
  judge: string;
  court: string;
  caseNumber: string;
  tags: string[];
}

const DEFAULT_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  judge: "",
  court: "",
  caseNumber: "",
  tags: [],
};

function countActiveFilters(f: Filters): number {
  return (
    (f.dateFrom ? 1 : 0) +
    (f.dateTo ? 1 : 0) +
    (f.judge ? 1 : 0) +
    (f.court ? 1 : 0) +
    (f.caseNumber ? 1 : 0) +
    f.tags.length
  );
}

// ── Parish case helpers ──────────────────────────────────────────────────────

function getWeekMonday(): string {
  const str = new Date().toLocaleDateString("en-CA", { timeZone: "America/Jamaica" });
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().split("T")[0];
}

function adaptParishCase(c: ParishCourtCase): CourtSitting {
  return {
    id: c.id,
    case_number: null,
    title: c.accused_name
      ? `${c.accused_name} — ${c.parish} Parish Court`
      : `${c.parish} Parish Court`,
    judge_name: null,
    court_division: "Parish Court",
    event_type: c.status ?? null,
    event_date: c.week_of ?? null,
    event_time: null,
    lawyers: null,
    pdf_source_url: c.pdf_source_url ?? null,
    created_at: c.created_at,
    snippet: c.offence ?? null,
    _source: "parish",
  };
}

function sortByEventDate(items: CourtSitting[]): CourtSitting[] {
  return [...items].sort((a, b) => {
    const da = a.event_date ?? "9999-99-99";
    const db = b.event_date ?? "9999-99-99";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

// ── Tab toggle ──────────────────────────────────────────────────────────────

function TabToggle({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex rounded-2xl bg-muted/40 p-1.5 gap-1.5">
      {(
        [
          { id: "judgments" as Tab, icon: Scale, label: "Judgments", sub: "Past decisions" },
          { id: "sittings" as Tab, icon: Calendar, label: "Court Lists", sub: "Upcoming sittings" },
        ] as const
      ).map(({ id, icon: Icon, label, sub }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            "flex flex-1 items-center justify-center gap-3 rounded-xl px-5 py-4",
            "transition-all duration-200 active:scale-[0.97]",
            active === id
              ? "bg-[#009B3A] text-white shadow-[0_4px_20px_rgba(0,155,58,0.4)]"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          ].join(" ")}
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={active === id ? 2.2 : 1.8} />
          <div className="text-left">
            <p className="text-[15px] font-semibold leading-none">{label}</p>
            <p className={`mt-1 text-[11px] leading-none ${active === id ? "text-white/65" : "text-muted-foreground/60"}`}>
              {sub}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Judge autocomplete input ────────────────────────────────────────────────

function JudgeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await apiClient.getJudgesAutocomplete(q);
      setSuggestions(res.names);
      setOpen(res.names.length > 0);
    } catch { /* ignore */ }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(v), 200);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#009B3A]/60 transition-colors";

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        className={inputCls}
        placeholder="e.g. Sykes J"
        value={value}
        onChange={handleChange}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {suggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onMouseDown={(e) => { e.preventDefault(); onChange(name); setOpen(false); setSuggestions([]); }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Filter panel ────────────────────────────────────────────────────────────

function FilterPanel({
  open,
  activeTab,
  filters,
  onChange,
  onClear,
}: {
  open: boolean;
  activeTab: Tab;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const labelCls = "block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1.5";
  const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-[#009B3A]/60 transition-colors";

  const toggleTag = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ tags: next });
  };

  return (
    <div
      className={[
        "overflow-hidden transition-all duration-300 ease-in-out",
        open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
      ].join(" ")}
    >
      <div className="rounded-2xl border border-border bg-card p-5 mt-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Date From */}
          <div>
            <label className={labelCls}>Date From</label>
            <input
              type="date"
              className={inputCls}
              value={filters.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
            />
          </div>

          {/* Date To */}
          <div>
            <label className={labelCls}>Date To</label>
            <input
              type="date"
              className={inputCls}
              value={filters.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value })}
            />
          </div>

          {/* Judge */}
          <div>
            <label className={labelCls}>Judge Name</label>
            <JudgeInput value={filters.judge} onChange={(v) => onChange({ judge: v })} />
          </div>

          {/* Court */}
          <div>
            <label className={labelCls}>Court</label>
            <select
              className={inputCls + " cursor-pointer"}
              value={filters.court}
              onChange={(e) => onChange({ court: e.target.value })}
            >
              <option value="">All Courts</option>
              {COURTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Case Number */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className={labelCls}>Case Number</label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. CL 2024/001"
              value={filters.caseNumber}
              onChange={(e) => onChange({ caseNumber: e.target.value })}
            />
          </div>

          {/* Category Tags (judgments only) */}
          {activeTab === "judgments" && (
            <div className="sm:col-span-2 lg:col-span-2">
              <label className={labelCls}>Category Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleTag(value)}
                    className={[
                      "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                      filters.tags.includes(value)
                        ? "border-[#009B3A]/50 bg-[#009B3A]/15 text-[#009B3A]"
                        : "border-border bg-background text-muted-foreground hover:border-[#009B3A]/30 hover:text-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all filters
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Active filter chips ──────────────────────────────────────────────────────

function ActiveChips({
  filters,
  onChange,
  onClearAll,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClearAll: () => void;
}) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.court) chips.push({ label: `Court: ${filters.court}`, onRemove: () => onChange({ court: "" }) });
  if (filters.judge) chips.push({ label: `Judge: ${filters.judge}`, onRemove: () => onChange({ judge: "" }) });
  if (filters.dateFrom) chips.push({ label: `From: ${filters.dateFrom}`, onRemove: () => onChange({ dateFrom: "" }) });
  if (filters.dateTo) chips.push({ label: `To: ${filters.dateTo}`, onRemove: () => onChange({ dateTo: "" }) });
  if (filters.caseNumber) chips.push({ label: `Case: ${filters.caseNumber}`, onRemove: () => onChange({ caseNumber: "" }) });
  for (const tag of filters.tags) {
    const label = TAG_OPTIONS.find((t) => t.value === tag)?.label ?? tag;
    chips.push({ label: `Tag: ${label}`, onRemove: () => onChange({ tags: filters.tags.filter((t) => t !== tag) }) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5 mt-3">
      {chips.map(({ label, onRemove }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 shrink-0 rounded-full border border-[#009B3A]/30 bg-[#009B3A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#009B3A]"
        >
          {label}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-0.5 hover:bg-[#009B3A]/20 transition-colors"
            aria-label={`Remove ${label} filter`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Clear all
      </button>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <Skeleton className="h-3.5 w-2/3 bg-muted" />
        <Skeleton className="h-5 w-20 rounded-md bg-muted shrink-0" />
      </div>
      <div className="space-y-2 pt-1">
        <Skeleton className="h-2.5 w-1/2 bg-muted/60" />
        <Skeleton className="h-2.5 w-2/5 bg-muted/60" />
        <Skeleton className="h-2.5 w-1/3 bg-muted/60" />
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  hasQuery,
  onClear,
}: {
  tab: Tab;
  hasQuery: boolean;
  onClear: () => void;
}) {
  if (hasQuery) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center px-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border">
          <SearchX className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">No results found</p>
        <p className="mt-1.5 text-xs text-muted-foreground/60 max-w-[220px] leading-relaxed">
          Try different keywords or adjust your filters.
        </p>
        <button
          onClick={onClear}
          className="mt-5 rounded-xl bg-[#009B3A]/15 border border-[#009B3A]/30 px-5 py-2 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/25 transition-colors"
        >
          Clear search &amp; filters
        </button>
      </div>
    );
  }
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center px-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009B3A]/[0.07] ring-1 ring-[#009B3A]/20">
        {tab === "judgments" ? <Scale className="h-7 w-7 text-[#009B3A]/50" /> : <Calendar className="h-7 w-7 text-[#009B3A]/50" />}
      </div>
      <p className="text-sm font-semibold text-muted-foreground">
        No {tab === "judgments" ? "judgments" : "sittings"} yet
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground/60 max-w-[220px] leading-relaxed">
        New cases are scraped daily. Check back soon.
      </p>
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 4) pages.push("…");
  for (let p = Math.max(2, current - 2); p <= Math.min(total - 1, current + 2); p++) pages.push(p);
  if (current < total - 3) pages.push("…");
  pages.push(total);
  return pages;
}

function Pagination({
  page, totalPages, total, itemLabel, disabled, onPageChange,
}: {
  page: number; totalPages: number; total: number; itemLabel: string; disabled?: boolean; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pageList = buildPageList(page, totalPages);
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="text-[11px] text-muted-foreground">
        Page {page} of {totalPages} &middot; {total.toLocaleString()} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1 || disabled} aria-label="Previous page"
          className="flex min-h-[44px] items-center gap-1 rounded-xl border border-border bg-card px-3 text-[13px] text-foreground/60 transition-all hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Prev</span>
        </button>
        {pageList.map((n, i) =>
          n === "…" ? (
            <span key={`e-${i}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[13px] text-muted-foreground/50">…</span>
          ) : (
            <button key={n} onClick={() => onPageChange(n as number)} disabled={disabled}
              aria-current={n === page ? "page" : undefined}
              className={["flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border text-[13px] font-medium transition-all",
                n === page ? "border-[#009B3A]/50 bg-[#009B3A]/15 text-[#009B3A]"
                  : "border-border bg-card text-foreground/60 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"].join(" ")}>
              {n}
            </button>
          )
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages || disabled} aria-label="Next page"
          className="flex min-h-[44px] items-center gap-1 rounded-xl border border-border bg-card px-3 text-[13px] text-foreground/60 transition-all hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30">
          <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const router = useRouter();
  const { isTracked, track, untrack } = useTracking();

  const [activeTab, setActiveTab] = useState<Tab>("judgments");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Judgments pagination
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [judgementsTotal, setJudgementsTotal] = useState(0);
  const [judgmentsPage, setJudgmentsPage] = useState(1);

  // Sittings pagination
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [sittingsTotal, setSittingsTotal] = useState(0);
  const [sittingsPage, setSittingsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchJudgments = useCallback(
    async (q: string, page: number, append: boolean, f: Filters) => {
      append ? setLoadingMore(true) : (setLoading(true), setJudgmentsPage(page));
      try {
        const res = await apiClient.getJudgments({
          q: q || undefined,
          court: f.court || undefined,
          judge: f.judge || undefined,
          tag: f.tags.length ? f.tags.join(",") : undefined,
          date_from: f.dateFrom || undefined,
          date_to: f.dateTo || undefined,
          case_number: f.caseNumber || undefined,
          page,
          limit: LIMIT,
        });
        setJudgementsTotal(res.total ?? res.judgments.length);
        setJudgments((prev) => append ? [...prev, ...res.judgments] : res.judgments);
      } catch (err) {
        console.error("Failed to fetch judgments:", err);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [],
  );

  const fetchSittings = useCallback(
    async (q: string, page: number, append: boolean, f: Filters) => {
      append ? setLoadingMore(true) : (setLoading(true), setSittingsPage(page));
      try {
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Jamaica" });
        const weekMonday = getWeekMonday();
        const isParishOnly = f.court === "Parish Court";
        const includeParish = !f.court || isParishOnly;

        let merged: CourtSitting[] = [];
        let total = 0;

        if (!isParishOnly) {
          const res = await apiClient.getCourtSittings({
            q: q || undefined,
            court: f.court || undefined,
            judge: f.judge || undefined,
            case_number: f.caseNumber || undefined,
            date_from: f.dateFrom || todayStr,
            date_to: f.dateTo || undefined,
            page,
            limit: LIMIT,
          });
          merged = res.sittings;
          total = res.total ?? res.sittings.length;
        }

        if (includeParish && !append) {
          const parishRes = await apiClient.getParishCases({
            q: q || undefined,
            date_from: f.dateFrom || weekMonday,
            limit: 200,
          });
          const adapted = parishRes.cases.map(adaptParishCase);
          if (isParishOnly) {
            merged = adapted;
            total = parishRes.total ?? adapted.length;
          } else {
            merged = sortByEventDate([...merged, ...adapted]);
            total += parishRes.total ?? adapted.length;
          }
        }

        setSittingsTotal(total);
        setSittings((prev) => append ? [...prev, ...merged] : merged);
      } catch (err) {
        console.error("Failed to fetch sittings:", err);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [],
  );

  // Read URL params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get("q") || "";
    const initialTab = (params.get("tab") as Tab) || "judgments";
    const courtSlug = params.get("court");
    const initialCourt = courtSlug ? (SLUG_TO_COURT[courtSlug] as string) || courtSlug : "";

    const initialFilters = { ...DEFAULT_FILTERS, court: initialCourt };
    setQuery(initialQ);
    setActiveTab(initialTab);
    setFilters(initialFilters);

    if (initialTab === "judgments") {
      void fetchJudgments(initialQ, 1, false, initialFilters);
    } else {
      void fetchSittings(initialQ, 1, false, initialFilters);
    }
  }, [fetchJudgments, fetchSittings]);

  const syncUrl = useCallback((q: string, tab: Tab, court: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tab !== "judgments") params.set("tab", tab);
    if (court) {
      const slug = (COURT_TO_SLUG as Record<string, string>)[court] || court.toLowerCase().replace(/\s+/g, "-");
      params.set("court", slug);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    syncUrl(q, activeTab, filters.court);
    if (activeTab === "judgments") void fetchJudgments(q, 1, false, filters);
    else void fetchSittings(q, 1, false, filters);
  }, [activeTab, filters, fetchJudgments, fetchSittings, syncUrl]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    syncUrl(query, tab, filters.court);
    if (tab === "judgments") void fetchJudgments(query, 1, false, filters);
    else void fetchSittings(query, 1, false, filters);
  };

  const handleFilterChange = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    const next = { ...filters, ...patch };
    syncUrl(query, activeTab, next.court);
    if (activeTab === "judgments") void fetchJudgments(query, 1, false, next);
    else void fetchSittings(query, 1, false, next);
  }, [filters, query, activeTab, fetchJudgments, fetchSittings, syncUrl]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    syncUrl(query, activeTab, "");
    if (activeTab === "judgments") void fetchJudgments(query, 1, false, DEFAULT_FILTERS);
    else void fetchSittings(query, 1, false, DEFAULT_FILTERS);
  }, [query, activeTab, fetchJudgments, fetchSittings, syncUrl]);

  const handleClearAll = useCallback(() => {
    setQuery("");
    setFilters(DEFAULT_FILTERS);
    syncUrl("", activeTab, "");
    if (activeTab === "judgments") void fetchJudgments("", 1, false, DEFAULT_FILTERS);
    else void fetchSittings("", 1, false, DEFAULT_FILTERS);
  }, [activeTab, fetchJudgments, fetchSittings, syncUrl]);

  const handlePageChange = useCallback((newPage: number) => {
    if (activeTab === "judgments") {
      setJudgmentsPage(newPage);
      void fetchJudgments(query, newPage, false, filters);
    } else {
      setSittingsPage(newPage);
      void fetchSittings(query, newPage, false, filters);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, query, filters, fetchJudgments, fetchSittings]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === "judgments") {
      const next = judgmentsPage + 1;
      setJudgmentsPage(next);
      void fetchJudgments(query, next, true, filters);
    } else {
      const next = sittingsPage + 1;
      setSittingsPage(next);
      void fetchSittings(query, next, true, filters);
    }
  }, [activeTab, judgmentsPage, sittingsPage, query, filters, fetchJudgments, fetchSittings]);

  const activeFilterCount = countActiveFilters(filters);
  const hasQuery = !!(query || activeFilterCount > 0);

  const totalCount = activeTab === "judgments" ? judgementsTotal : sittingsTotal;
  const shownCount = activeTab === "judgments" ? judgments.length : sittings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
  const currentPage = activeTab === "judgments" ? judgmentsPage : sittingsPage;
  const hasMore = shownCount < totalCount;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">

          {/* Header */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                Case Registry
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-6">
              Search Cases
            </h1>
            <TabToggle active={activeTab} onChange={handleTabChange} />

            {/* Quick access row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => router.push("/parish-court")}
                className="flex items-center gap-2 rounded-full border border-[#CD7F32]/30 bg-[#CD7F32]/10 px-4 py-2 text-[12px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/50 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Parish Court
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mb-3">
            <SearchBar
              key={activeTab}
              initialValue={query}
              onSearch={handleSearch}
              placeholder={
                activeTab === "judgments"
                  ? "Search by case number, title, judge, or court…"
                  : "Search by case number, title, or judge…"
              }
            />
          </div>

          {/* Filters toggle + panel */}
          <div className="mb-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={[
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                  activeFilterCount > 0
                    ? "border-[#009B3A]/40 bg-[#009B3A]/10 text-[#009B3A] hover:bg-[#009B3A]/20"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent",
                ].join(" ")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
              </button>

              {activeFilterCount > 0 && !filtersOpen && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <FilterPanel
              open={filtersOpen}
              activeTab={activeTab}
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          </div>

          {/* Active filter chips */}
          <ActiveChips
            filters={filters}
            onChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />

          {/* Result count */}
          {!loading && (
            <p className="mt-3 mb-4 text-[11px] text-muted-foreground">
              {shownCount < totalCount
                ? `Showing ${shownCount.toLocaleString()} of ${totalCount.toLocaleString()}`
                : totalCount.toLocaleString()}{" "}
              {activeTab === "judgments"
                ? `judgment${totalCount !== 1 ? "s" : ""}`
                : `sitting${totalCount !== 1 ? "s" : ""}`}
              {query ? ` matching "${query}"` : ""}
            </p>
          )}

          {/* Results */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeTab === "judgments" ? (
                  judgments.length > 0 ? (
                    judgments.map((j) => (
                      <CaseCard
                        key={j.id}
                        judgment={j}
                        onClick={() => router.push(`/cases/${j.id}`)}
                        isTracked={isTracked(j.id, "judgment")}
                        onTrack={(id) => isTracked(id, "judgment") ? untrack(id) : track(id, "judgment")}
                      />
                    ))
                  ) : (
                    <EmptyState tab="judgments" hasQuery={hasQuery} onClear={handleClearAll} />
                  )
                ) : sittings.length > 0 ? (
                  sittings.map((s) => (
                    <SittingCard
                      key={`${s._source ?? "cs"}-${s.id}`}
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
                          : (id) => isTracked(id, "sitting") ? untrack(id) : track(id, "sitting")
                      }
                    />
                  ))
                ) : (
                  <EmptyState tab="sittings" hasQuery={hasQuery} onClear={handleClearAll} />
                )}
              </div>

              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={totalCount}
                itemLabel={activeTab === "judgments" ? "judgments" : "sittings"}
                disabled={loadingMore}
                onPageChange={handlePageChange}
              />

              {hasMore && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground/60 hover:bg-accent hover:text-foreground active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                    ) : (
                      <><ChevronDown className="h-4 w-4" />Load More</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
