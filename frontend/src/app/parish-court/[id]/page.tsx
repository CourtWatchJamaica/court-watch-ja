"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiClient } from "@/lib/api";
import type { ParishCourtCase, ParishCaseDetail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  AlertTriangle,
  Home,
  Pill,
  Shield,
  Hash,
} from "lucide-react";

// ── Categorisation (mirrors dashboard + backend) ──────────────────────────────

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
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  Violent:  { label: "Violent",  color: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/30",   Icon: AlertTriangle },
  Property: { label: "Property", color: "text-blue-400",  bg: "bg-blue-500/10",  border: "border-blue-500/30",  Icon: Home },
  Drugs:    { label: "Drugs",    color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", Icon: Pill },
  Other:    { label: "Other",    color: "text-gray-400",  bg: "bg-gray-500/10",  border: "border-gray-500/30",  Icon: Shield },
};

const STATUS_LABELS: Record<string, string> = {
  M: "Mention", H: "Hearing", T: "Trial", A: "Adjourned",
  C: "Committed", D: "Dismissed", P: "Plea", F: "Fine Paid", E: "Estreat",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWeekOf(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-JM", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parishCourtUrl(parish: string): string {
  const slug = parish.toLowerCase().replace(/\./g, "").trim().replace(/\s+/g, "-");
  return `https://parishcourt.gov.jm/court-name/${slug}-parish-court`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-1/2 rounded-xl bg-white/[0.06]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}

// ── Charge row ────────────────────────────────────────────────────────────────

function ChargeRow({
  c,
  selectedId,
}: {
  c: ParishCourtCase;
  selectedId: number;
}) {
  const router = useRouter();
  const isSelected = c.id === selectedId;
  const cat = categorise(c.offence);
  const cfg = CATEGORY_CONFIG[cat];
  const CatIcon = cfg.Icon;
  const statusLabel = c.status ? (STATUS_LABELS[c.status] ?? c.status) : null;

  return (
    <button
      onClick={() => router.push(`/parish-court/${c.id}`)}
      className={[
        "w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 min-h-[56px]",
        isSelected
          ? "border-[#CD7F32]/40 bg-[#CD7F32]/[0.06] hover:bg-[#CD7F32]/[0.09]"
          : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05]",
      ].join(" ")}
      style={isSelected ? { borderLeft: "3px solid #CD7F32" } : undefined}
    >
      {/* Category icon */}
      <span className={`mt-0.5 shrink-0 ${cfg.color}`}>
        <CatIcon className="h-3.5 w-3.5" />
      </span>

      {/* Offence + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/85 leading-snug">
          {c.offence ?? "—"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {statusLabel && (
            <span className="text-[10px] text-white/35">{statusLabel}</span>
          )}
          {c.week_of && (
            <span className="flex items-center gap-1 text-[10px] text-white/25">
              <Calendar className="h-2.5 w-2.5" />
              {formatWeekOf(c.week_of)}
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {c.pdf_source_url && (
          <a
            href={c.pdf_source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-[#CD7F32]/60 hover:text-[#CD7F32] transition-colors"
            title="View source PDF"
          >
            <FileText className="h-3 w-3" />
            <span className="hidden sm:inline">PDF</span>
          </a>
        )}
        {isSelected && (
          <Badge className="bg-[#CD7F32]/15 text-[#CD7F32] border border-[#CD7F32]/30 text-[9px] px-1.5 h-4 rounded-full">
            selected
          </Badge>
        )}
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ParishCaseDetail() {
  const params = useParams();
  const router = useRouter();
  const selectedId = Number(params.id);

  const [detail, setDetail] = useState<ParishCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!selectedId) { setNotFound(true); setLoading(false); return; }
    apiClient
      .getParishCase(selectedId)
      .then(setDetail)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const courtCase = detail?.case ?? null;
  const allCharges = detail?.all_charges ?? [];
  const tallies = detail?.offence_tallies;
  const totalCount = detail?.total_count ?? 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a00 100%)" }}
    >
      {/* Header bar */}
      <div className="border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-[#CD7F32]/30 shrink-0"
              style={{ background: "rgba(205,127,50,0.12)" }}
            >
              <MapPin className="h-4 w-4" style={{ color: "#CD7F32" }} />
            </div>
            <span className="text-sm font-semibold text-white/70">Parish Court</span>
          </div>

          {courtCase && (
            <a
              href={parishCourtUrl(courtCase.parish)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-medium text-[#CD7F32]/60 hover:text-[#CD7F32] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">parishcourt.gov.jm</span>
              <span className="sm:hidden">Official site</span>
            </a>
          )}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12 space-y-6">
        {/* Back link */}
        <button
          onClick={() => router.push("/parish-court")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-4 py-2.5 text-[13px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 hover:border-[#CD7F32]/40 active:scale-[0.97] transition-all duration-150 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Parish Court
        </button>

        {loading ? (
          <DetailSkeleton />
        ) : notFound || !courtCase ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-black/30 py-16 text-center gap-4 px-6">
            <p className="text-sm text-white/40">Case not found.</p>
            <button
              onClick={() => router.push("/parish-court")}
              className="rounded-xl border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-4 py-2.5 text-[13px] font-semibold text-[#CD7F32] hover:bg-[#CD7F32]/20 transition-colors"
            >
              Back to Parish Court
            </button>
          </div>
        ) : (
          <>
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                borderLeft: "3px solid #CD7F32",
                background: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="p-6">
                {/* Parish + official link */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="flex items-center gap-1.5 rounded-full border border-[#CD7F32]/25 bg-[#CD7F32]/10 px-2.5 py-1 text-[10px] font-semibold text-[#CD7F32]">
                    <MapPin className="h-3 w-3" />
                    {courtCase.parish}
                  </span>
                  <a
                    href={parishCourtUrl(courtCase.parish)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/35 hover:text-white/60 hover:border-white/[0.15] transition-colors"
                  >
                    View official court list
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>

                {/* Accused name */}
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-1">
                  {courtCase.accused_name ?? "Unknown"}
                </h1>
                <p className="text-[12px] text-white/30 flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Case record #{courtCase.id} · Indexed{" "}
                  {new Date(courtCase.created_at).toLocaleDateString("en-JM")}
                </p>
              </div>
            </div>

            {/* ── Offence tally cards ───────────────────────────────────── */}
            {tallies && (
              <section>
                <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
                  Charge Summary — {totalCount} total
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { cat: "Violent"  as Category, count: tallies.violent  },
                      { cat: "Property" as Category, count: tallies.property },
                      { cat: "Drugs"    as Category, count: tallies.drugs    },
                      { cat: "Other"    as Category, count: tallies.other    },
                    ] satisfies { cat: Category; count: number }[]
                  ).map(({ cat, count }) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const CatIcon = cfg.Icon;
                    return (
                      <div
                        key={cat}
                        className={`rounded-2xl border p-4 min-h-[80px] ${
                          count > 0
                            ? `${cfg.bg} ${cfg.border}`
                            : "border-white/[0.05] bg-white/[0.02]"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-2 mb-2 ${
                            count > 0 ? cfg.color : "text-white/25"
                          }`}
                        >
                          <CatIcon className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">
                            {cfg.label}
                          </span>
                        </div>
                        <p
                          className={`text-3xl font-bold ${
                            count > 0 ? cfg.color : "text-white/20"
                          }`}
                        >
                          {count}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Full charge list ──────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
                All Charges{allCharges.length > 0 ? ` · ${allCharges.length}` : ""}
              </h2>
              {allCharges.length === 0 ? (
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-10 text-center">
                  <p className="text-[13px] text-white/30">No charges on record.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allCharges.map((c) => (
                    <ChargeRow key={c.id} c={c} selectedId={selectedId} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function ParishCourtCasePage() {
  return (
    <AuthGuard>
      <ParishCaseDetail />
    </AuthGuard>
  );
}
