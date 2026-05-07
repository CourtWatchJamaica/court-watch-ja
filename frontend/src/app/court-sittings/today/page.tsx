"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import SittingCard from "@/components/SittingCard";
import { apiClient } from "@/lib/api";
import type { CourtSitting } from "@/lib/types";
import { useTracking } from "@/lib/tracking-context";
import { ArrowLeft, Calendar, Scale, Building2, Gavel } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Court grouping ────────────────────────────────────────────────────────────

type CourtGroup = "Supreme Court" | "Court of Appeal" | "Parish Court";

const COURT_ORDER: CourtGroup[] = ["Supreme Court", "Court of Appeal", "Parish Court"];

const COURT_CONFIG: Record<
  CourtGroup,
  { label: string; Icon: React.ComponentType<{ className?: string }>; accent: string; bg: string }
> = {
  "Supreme Court": {
    label: "Supreme Court",
    Icon: Scale,
    accent: "text-[#009B3A]",
    bg: "bg-[#009B3A]/10",
  },
  "Court of Appeal": {
    label: "Court of Appeal",
    Icon: Gavel,
    accent: "text-[#FED100]",
    bg: "bg-[#FED100]/10",
  },
  "Parish Court": {
    label: "Parish Court",
    Icon: Building2,
    accent: "text-[#CD7F32]",
    bg: "bg-[#CD7F32]/10",
  },
};

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
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-4 space-y-3">
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
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
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
    apiClient
      .getCourtSittings({ date_from: today, date_to: today })
      .then((res) => setSittings(res.sittings))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [today]);

  const grouped = useMemo(() => {
    const map: Record<CourtGroup, CourtSitting[]> = {
      "Supreme Court": [],
      "Court of Appeal": [],
      "Parish Court": [],
    };
    for (const s of sittings) {
      map[classifyCourtDivision(s.court_division)].push(s);
    }
    return map;
  }, [sittings]);

  const totalCount = sittings.length;
  const activeGroups = COURT_ORDER.filter((g) => loading || grouped[g].length > 0);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0d1a0d 100%)" }}
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
              <span className="text-sm font-semibold text-white/80">Today's Sittings</span>
              <p className="text-[10px] text-white/30 leading-none mt-0.5">{todayLabel}</p>
            </div>
          </div>
          {!loading && (
            <span className="text-[11px] font-medium text-white/30">
              {totalCount} sitting{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 space-y-10">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.97] transition-all duration-150 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {loading ? (
          <div className="space-y-10">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-black/30 py-20 text-center px-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FED100]/[0.07] ring-1 ring-[#FED100]/15">
              <Calendar className="h-7 w-7 text-[#FED100]/40" />
            </div>
            <p className="text-sm font-semibold text-white/40">No sittings scheduled today</p>
            <p className="mt-1.5 text-xs text-white/20 max-w-[220px] leading-relaxed">
              Court lists are updated daily. Check back soon.
            </p>
          </div>
        ) : (
          activeGroups.map((group) => {
            const cfg = COURT_CONFIG[group];
            const items = grouped[group];
            if (items.length === 0) return null;
            const CfgIcon = cfg.Icon;
            return (
              <section key={group}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${cfg.bg}`}
                  >
                    <CfgIcon className={`h-4 w-4 ${cfg.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-sm font-bold ${cfg.accent}`}>{cfg.label}</h2>
                    <p className="text-[10px] text-white/30 leading-none mt-0.5">
                      {items.length} sitting{items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex-1 h-px bg-white/[0.05] ml-2" />
                </div>

                {/* Cards grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => (
                    <SittingCard
                      key={s.id}
                      sitting={s}
                      onClick={() => router.push(`/cases/sittings/${s.id}`)}
                      isTracked={isTracked(s.id, "sitting")}
                      onTrack={(id) =>
                        isTracked(id, "sitting") ? untrack(id) : track(id, "sitting")
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })
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
