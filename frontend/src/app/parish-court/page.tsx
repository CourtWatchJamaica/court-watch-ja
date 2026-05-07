"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ParishCourtCase, ParishSummary } from "@/lib/types";
import AuthGuard from "@/components/AuthGuard";
import { Search, X, MapPin, AlertTriangle, Home, Pill, Shield, ChevronRight, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Offence categorisation ────────────────────────────────────────────────────

type Category = "Violent" | "Property" | "Drugs" | "Other";

const VIOLENT_KEYWORDS = [
  "murder", "manslaughter", "assault", "wounding", "robbery", "rape",
  "sexual", "grievous", "gun", "firearm", "shooting", "stabbing", "arson",
];
const PROPERTY_KEYWORDS = [
  "larceny", "theft", "burglary", "housebreaking", "fraud", "forgery",
  "obtaining", "malicious", "damage", "possession of sto",
];
const DRUG_KEYWORDS = [
  "ganja", "cannabis", "cocaine", "drug", "possession of prohib", "traffick",
  "dangerous drug",
];

function categorise(offence: string | null): Category {
  if (!offence) return "Other";
  const o = offence.toLowerCase();
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

// ── Component ─────────────────────────────────────────────────────────────────

function ParishCourtDashboard() {
  const router = useRouter();
  const [cases, setCases] = useState<ParishCourtCase[]>([]);
  const [summary, setSummary] = useState<ParishSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [selectedParish, setSelectedParish] = useState<string | null>(null);

  // Fetch summary once — parish card totals are global, not filtered
  useEffect(() => {
    apiClient.getParishSummary()
      .then((res) => setSummary(res.summary))
      .catch(() => {});
  }, []);

  // Re-fetch cases whenever selectedParish changes; pass parish to API so
  // the server does the filtering (avoids name-mismatch bugs client-side)
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiClient
      .getParishCases({
        limit: 200,
        ...(selectedParish ? { parish: selectedParish } : {}),
      })
      .then((res) => {
        if (!active) return;
        setCases(res.cases);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedParish]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      Violent: 0,
      Property: 0,
      Drugs: 0,
      Other: 0,
    };
    for (const c of cases) {
      counts[categorise(c.offence)] += 1;
    }
    return counts;
  }, [cases]);

  // Parish filtering is now done server-side; only apply category + search here
  const filtered = useMemo(() => {
    let out = cases;
    if (activeCategory) out = out.filter((c) => categorise(c.offence) === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.accused_name?.toLowerCase().includes(q) ||
          c.offence?.toLowerCase().includes(q) ||
          c.parish.toLowerCase().includes(q),
      );
    }
    return out;
  }, [cases, activeCategory, search]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory(null);
    setSelectedParish(null);
  }, []);

  const hasFilters = search || activeCategory || selectedParish;

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
                Jamaica's 14 Parishes · {cases.length} cases indexed
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28 md:pb-10">
        {/* Offence Breakdown Cards — 2×2 on mobile, 4 across on sm+ */}
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
                    {loading ? "—" : categoryCounts[cat]}
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accused, offence, or parish…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-10 pr-10 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#CD7F32]/50 focus:ring-1 focus:ring-[#CD7F32]/25 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-white/40 hover:text-white/70 transition-colors whitespace-nowrap"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-white/30">
            {loading ? "Loading…" : `${filtered.length} case${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </section>

        {/* Recent Cases Feed */}
        <section>
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
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] py-16 text-center">
              <p className="text-white/30 text-sm">No cases match your filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 100).map((c) => {
                const cat = categorise(c.offence);
                const cfg = CATEGORY_CONFIG[cat];
                const statusLabel = c.status ? STATUS_LABELS[c.status] ?? c.status : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/parish-court/${c.id}`)}
                    className="w-full flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.07] hover:border-white/[0.10] active:scale-[0.99] transition-all duration-150 min-h-[56px]"
                  >
                    {/* Category dot */}
                    <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.color.replace("text-", "bg-")}`} />

                    {/* Name + offence */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">
                        {c.accused_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {c.offence ?? "—"}
                      </p>
                    </div>

                    {/* Badges */}
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
              {filtered.length > 100 && (
                <p className="text-center text-xs text-white/25 pt-2">
                  Showing 100 of {filtered.length} — refine your search to narrow results
                </p>
              )}
            </div>
          )}
        </section>
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
