"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import CaseCard from "@/components/CaseCard";
import SittingCard from "@/components/SittingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { Judgment, CourtSitting } from "@/lib/types";
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
  Landmark,
} from "lucide-react";

const LIMIT = 20;

type Tab = "judgments" | "sittings";

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
            <p
              className={`mt-1 text-[11px] leading-none ${
                active === id ? "text-white/65" : "text-muted-foreground/60"
              }`}
            >
              {sub}
            </p>
          </div>
        </button>
      ))}
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

// ── Empty states ─────────────────────────────────────────────────────────────

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
          Try different keywords, or browse without a search term.
        </p>
        <button
          onClick={onClear}
          className="mt-5 rounded-xl bg-[#009B3A]/15 border border-[#009B3A]/30 px-5 py-2 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/25 transition-colors"
        >
          Clear search
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center px-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009B3A]/[0.07] ring-1 ring-[#009B3A]/20">
        {tab === "judgments" ? (
          <Scale className="h-7 w-7 text-[#009B3A]/50" />
        ) : (
          <Calendar className="h-7 w-7 text-[#009B3A]/50" />
        )}
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
  for (let p = Math.max(2, current - 2); p <= Math.min(total - 1, current + 2); p++) {
    pages.push(p);
  }
  if (current < total - 3) pages.push("…");
  pages.push(total);
  return pages;
}

function Pagination({
  page,
  totalPages,
  total,
  itemLabel,
  disabled,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemLabel: string;
  disabled?: boolean;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pageList = buildPageList(page, totalPages);

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <p className="text-[11px] text-muted-foreground">
        Page {page} of {totalPages} &middot;{" "}
        {total.toLocaleString()} {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1 || disabled}
          aria-label="Previous page"
          className="flex min-h-[44px] items-center gap-1 rounded-xl border border-border bg-card px-3 text-[13px] text-foreground/60 transition-all hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Page numbers */}
        {pageList.map((n, i) =>
          n === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[13px] text-muted-foreground/50"
            >
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n as number)}
              disabled={disabled}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              className={[
                "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border text-[13px] font-medium transition-all",
                n === page
                  ? "border-[#009B3A]/50 bg-[#009B3A]/15 text-[#009B3A]"
                  : "border-border bg-card text-foreground/60 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30",
              ].join(" ")}
            >
              {n}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || disabled}
          aria-label="Next page"
          className="flex min-h-[44px] items-center gap-1 rounded-xl border border-border bg-card px-3 text-[13px] text-foreground/60 transition-all hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
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
  const [courtFilter, setCourtFilter] = useState<string | null>(null);
  const [taxFilter, setTaxFilter] = useState(false);

  // Judgments — server-side pagination
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [judgementsTotal, setJudgementsTotal] = useState(0);
  const [judgmentsPage, setJudgmentsPage] = useState(1);

  // Sittings — server-side pagination
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [sittingsTotal, setSittingsTotal] = useState(0);
  const [sittingsPage, setSittingsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchJudgments = useCallback(
    async (q: string, page: number, append: boolean, court?: string | null, tax?: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setJudgmentsPage(page);
      }
      try {
        const res = await apiClient.getJudgments(
          q || undefined,
          court || undefined,
          undefined,
          page,
          LIMIT,
          tax ? "tax_law" : undefined,
        );
        setJudgementsTotal(res.total ?? res.judgments.length);
        setJudgments((prev) =>
          append ? [...prev, ...res.judgments] : res.judgments,
        );
      } catch (err) {
        console.error("Failed to fetch judgments:", err);
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [],
  );

  const fetchSittings = useCallback(
    async (q: string, page: number, append: boolean, court?: string | null) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setSittingsPage(page);
      }
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await apiClient.getCourtSittings({
          q: q || undefined,
          court: court || undefined,
          date_from: q ? undefined : today,
          page,
          limit: LIMIT,
        });
        setSittingsTotal(res.total ?? res.sittings.length);
        setSittings((prev) =>
          append ? [...prev, ...res.sittings] : res.sittings,
        );
      } catch (err) {
        console.error("Failed to fetch sittings:", err);
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [],
  );

  // Read ?q=, ?tab=, and ?court= from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get("q") || "";
    const initialTab = (params.get("tab") as Tab) || "judgments";
    // Convert slug (e.g. "court-of-appeal") → full name ("Court of Appeal")
    const courtSlug = params.get("court");
    const initialCourt = courtSlug
      ? (SLUG_TO_COURT[courtSlug] as string) || courtSlug
      : null;

    setQuery(initialQ);
    setActiveTab(initialTab);
    setCourtFilter(initialCourt);

    if (initialTab === "judgments") {
      void fetchJudgments(initialQ, 1, false, initialCourt, false);
    } else {
      void fetchSittings(initialQ, 1, false, initialCourt);
    }
  }, [fetchJudgments, fetchSittings]);

  const syncUrl = useCallback((q: string, tab: Tab, court: string | null) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tab !== "judgments") params.set("tab", tab);
    if (court) {
      const slug =
        (COURT_TO_SLUG as Record<string, string>)[court] ||
        court.toLowerCase().replace(/\s+/g, "-");
      params.set("court", slug);
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      syncUrl(q, activeTab, courtFilter);
      if (activeTab === "judgments") {
        void fetchJudgments(q, 1, false, courtFilter, taxFilter);
      } else {
        void fetchSittings(q, 1, false, courtFilter);
      }
    },
    [activeTab, courtFilter, taxFilter, fetchJudgments, fetchSittings, syncUrl],
  );

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    syncUrl(query, tab, courtFilter);
    if (tab === "judgments") {
      void fetchJudgments(query, 1, false, courtFilter, taxFilter);
    } else {
      void fetchSittings(query, 1, false, courtFilter);
    }
  };

  const handleClearSearch = () => {
    setQuery("");
    syncUrl("", activeTab, courtFilter);
    if (activeTab === "judgments") {
      void fetchJudgments("", 1, false, courtFilter, taxFilter);
    } else {
      void fetchSittings("", 1, false, courtFilter);
    }
  };

  const handleClearCourtFilter = () => {
    setCourtFilter(null);
    syncUrl(query, activeTab, null);
    if (activeTab === "judgments") {
      void fetchJudgments(query, 1, false, null, taxFilter);
    } else {
      void fetchSittings(query, 1, false, null);
    }
  };

  const handleToggleTaxFilter = () => {
    const next = !taxFilter;
    setTaxFilter(next);
    if (activeTab === "judgments") {
      void fetchJudgments(query, 1, false, courtFilter, next);
    }
  };

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (activeTab === "judgments") {
        setJudgmentsPage(newPage);
        void fetchJudgments(query, newPage, false, courtFilter, taxFilter);
      } else {
        setSittingsPage(newPage);
        void fetchSittings(query, newPage, false, courtFilter);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [activeTab, query, courtFilter, taxFilter, fetchJudgments, fetchSittings],
  );

  const handleLoadMore = useCallback(() => {
    if (activeTab === "judgments") {
      const nextPage = judgmentsPage + 1;
      setJudgmentsPage(nextPage);
      void fetchJudgments(query, nextPage, true, courtFilter, taxFilter);
    } else {
      const nextPage = sittingsPage + 1;
      setSittingsPage(nextPage);
      void fetchSittings(query, nextPage, true, courtFilter);
    }
  }, [activeTab, judgmentsPage, sittingsPage, query, courtFilter, taxFilter, fetchJudgments, fetchSittings]);

  const hasMoreJudgments = judgments.length < judgementsTotal;
  const hasMoreSittings = sittings.length < sittingsTotal;
  const hasMore = activeTab === "judgments" ? hasMoreJudgments : hasMoreSittings;

  const totalCount = activeTab === "judgments" ? judgementsTotal : sittingsTotal;
  const shownCount = activeTab === "judgments" ? judgments.length : sittings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
  const currentPage = activeTab === "judgments" ? judgmentsPage : sittingsPage;

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

            {/* Active filters row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Parish Court shortcut */}
              <button
                onClick={() => router.push("/parish-court")}
                className="flex items-center gap-2 rounded-full border border-[#CD7F32]/30 bg-[#CD7F32]/10 px-4 py-2 text-[12px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/50 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Parish Court
              </button>

              {/* Tax Law filter pill */}
              {activeTab === "judgments" && (
                <button
                  onClick={handleToggleTaxFilter}
                  className={[
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors",
                    taxFilter
                      ? "border-[#FED100]/50 bg-[#FED100]/15 text-[#FED100]"
                      : "border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70",
                  ].join(" ")}
                >
                  <Landmark className="h-3 w-3" />
                  Tax Law
                  {taxFilter && <X className="h-3 w-3 ml-0.5 opacity-70" />}
                </button>
              )}

              {/* Active court filter chip */}
              {courtFilter && (
                <button
                  onClick={handleClearCourtFilter}
                  className="flex items-center gap-1.5 rounded-full border border-[#009B3A]/35 bg-[#009B3A]/10 px-3 py-2 text-[12px] font-semibold text-[#009B3A] hover:bg-[#009B3A]/20 transition-colors"
                >
                  <Scale className="h-3 w-3" />
                  {courtFilter}
                  <X className="h-3 w-3 ml-0.5 opacity-70" />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
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

          {/* Result count */}
          {!loading && (
            <p className="mb-4 text-[11px] text-muted-foreground">
              {shownCount < (totalCount ?? 0)
                ? `Showing ${shownCount.toLocaleString()} of ${(totalCount ?? 0).toLocaleString()}`
                : (totalCount ?? 0).toLocaleString()}{" "}
              {activeTab === "judgments"
                ? `judgment${(totalCount ?? 0) !== 1 ? "s" : ""}`
                : `sitting${(totalCount ?? 0) !== 1 ? "s" : ""}`}
              {courtFilter ? ` · ${courtFilter}` : ""}
              {taxFilter ? " · Tax Law" : ""}
              {query ? ` matching "${query}"` : ""}
            </p>
          )}

          {/* Results */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
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
                        onTrack={(id) =>
                          isTracked(id, "judgment")
                            ? untrack(id)
                            : track(id, "judgment")
                        }
                      />
                    ))
                  ) : (
                    <EmptyState
                      tab="judgments"
                      hasQuery={!!(query || courtFilter || taxFilter)}
                      onClear={handleClearSearch}
                    />
                  )
                ) : sittings.length > 0 ? (
                  sittings.map((s) => (
                    <SittingCard
                      key={s.id}
                      sitting={s}
                      onClick={() => router.push(`/cases/sittings/${s.id}`)}
                      isTracked={isTracked(s.id, "sitting")}
                      onTrack={(id) =>
                        isTracked(id, "sitting")
                          ? untrack(id)
                          : track(id, "sitting")
                      }
                    />
                  ))
                ) : (
                  <EmptyState
                    tab="sittings"
                    hasQuery={!!(query || courtFilter)}
                    onClear={handleClearSearch}
                  />
                )}
              </div>

              {/* Numeric pagination */}
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={totalCount}
                itemLabel={activeTab === "judgments" ? "judgments" : "sittings"}
                disabled={loadingMore}
                onPageChange={handlePageChange}
              />

              {/* Load More (secondary) */}
              {hasMore && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground/60 hover:bg-accent hover:text-foreground active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Load More
                      </>
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
