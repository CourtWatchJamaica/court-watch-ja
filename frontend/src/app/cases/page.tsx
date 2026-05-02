"use client";

import { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import CaseCard from "@/components/CaseCard";
import { apiClient } from "@/lib/api";
import { Judgment, CourtSitting } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Calendar,
  FileText,
  User,
  Building2,
  Clock,
  ArrowUpRight,
} from "lucide-react";

type Tab = "judgments" | "sittings";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSittingTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

function formatSittingDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-JM", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TabToggle({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="flex rounded-2xl bg-black/30 p-1.5 gap-1.5">
      {(
        [
          {
            id: "judgments" as Tab,
            icon: Scale,
            label: "Judgments",
            sub: "Past decisions",
          },
          {
            id: "sittings" as Tab,
            icon: Calendar,
            label: "Court Lists",
            sub: "Upcoming sittings",
          },
        ] as const
      ).map(({ id, icon: Icon, label, sub }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            "flex flex-1 items-center justify-center gap-3 rounded-xl px-5 py-4",
            "transition-all duration-200 active:scale-[0.97] text-left",
            active === id
              ? "bg-[#009B3A] text-white shadow-[0_4px_20px_rgba(0,155,58,0.4)]"
              : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]",
          ].join(" ")}
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={active === id ? 2.2 : 1.8} />
          <div>
            <p className="text-[15px] font-semibold leading-none">{label}</p>
            <p
              className={`text-[11px] mt-1 leading-none ${
                active === id ? "text-white/65" : "text-white/30"
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

function SittingCard({ sitting }: { sitting: CourtSitting }) {
  return (
    <Card className="group relative bg-[#0d0d1a] border-l-2 border-l-[#FED100]/50 border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06] cursor-pointer overflow-hidden transition-all duration-300 hover:border-l-[#FED100] hover:bg-[#FED100]/[0.03] hover:shadow-[0_4px_24px_rgba(254,209,0,0.12)]">
      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[#FED100]/[0.04] via-transparent to-transparent" />

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white/85 text-[13px] leading-snug group-hover:text-white transition-colors line-clamp-2">
              {sitting.title || sitting.case_number || "Untitled Sitting"}
            </h3>
            {sitting.case_number && sitting.title && (
              <p className="mt-1 text-[10px] font-mono text-[#FED100]/50">
                {sitting.case_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sitting.event_type && (
              <Badge className="bg-[#FED100]/10 text-[#FED100] border border-[#FED100]/25 text-[10px] font-medium px-1.5 py-0 h-5 rounded-md whitespace-nowrap">
                {sitting.event_type}
              </Badge>
            )}
            <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-[#FED100]/60 transition-colors shrink-0" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-1.5">
          {sitting.judge_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <User className="h-3 w-3 text-white/25 shrink-0" />
              <span className="truncate">{sitting.judge_name}</span>
            </div>
          )}
          {sitting.court_division && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Building2 className="h-3 w-3 text-white/25 shrink-0" />
              <span className="truncate">{sitting.court_division}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {sitting.event_date && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <Calendar className="h-3 w-3 text-white/25 shrink-0" />
                <span>{formatSittingDate(sitting.event_date)}</span>
              </div>
            )}
            {sitting.event_time && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <Clock className="h-3 w-3 text-white/25 shrink-0" />
                <span>{formatSittingTime(sitting.event_time)}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Bottom gold sweep on hover */}
      <div className="absolute bottom-0 left-0 h-[1.5px] w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-[#FED100] via-[#FED100]/60 to-transparent" />
    </Card>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-4 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div className="h-3.5 w-2/3 rounded bg-white/[0.06]" />
        <div className="h-5 w-20 rounded-md bg-white/[0.06] shrink-0" />
      </div>
      <div className="space-y-2 pt-1">
        <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
        <div className="h-2.5 w-2/5 rounded bg-white/[0.04]" />
        <div className="h-2.5 w-1/3 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-20 text-center">
      {tab === "judgments" ? (
        <FileText className="mb-3 h-10 w-10 text-white/10" />
      ) : (
        <Calendar className="mb-3 h-10 w-10 text-white/10" />
      )}
      <p className="text-sm text-white/30">
        {tab === "judgments" ? "No judgments found" : "No sittings found"}
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("judgments");
  const [query, setQuery] = useState("");
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (q: string, tab: Tab) => {
    setLoading(true);
    try {
      if (tab === "judgments") {
        const res = await apiClient.getJudgments(q || undefined);
        setJudgments(res.judgments);
      } else {
        const res = await apiClient.getCourtSittings(q || undefined);
        setSittings(res.sittings);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData("", "judgments");
  }, [fetchData]);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      fetchData(q, activeTab);
    },
    [fetchData, activeTab],
  );

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    fetchData(query, tab);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">

          {/* ── Header ── */}
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

            {/* ── Tab Toggle ── */}
            <TabToggle active={activeTab} onChange={handleTabChange} />
          </div>

          {/* ── Search ── */}
          <div className="mb-6">
            <SearchBar
              key={activeTab}
              onSearch={handleSearch}
              placeholder={
                activeTab === "judgments"
                  ? "Search by case number, title, judge, or court…"
                  : "Search by case number, title, or judge…"
              }
            />
          </div>

          {/* ── Result count hint ── */}
          {!loading && (
            <p className="mb-4 text-[11px] text-white/25">
              {activeTab === "judgments"
                ? `${judgments.length} judgment${judgments.length !== 1 ? "s" : ""}`
                : `${sittings.length} sitting${sittings.length !== 1 ? "s" : ""}`}
              {query ? ` matching "${query}"` : ""}
            </p>
          )}

          {/* ── Results ── */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeTab === "judgments" ? (
                judgments.length > 0 ? (
                  judgments.map((j) => (
                    <CaseCard key={j.id} judgment={j} />
                  ))
                ) : (
                  <EmptyState tab="judgments" />
                )
              ) : sittings.length > 0 ? (
                sittings.map((s) => <SittingCard key={s.id} sitting={s} />)
              ) : (
                <EmptyState tab="sittings" />
              )}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
