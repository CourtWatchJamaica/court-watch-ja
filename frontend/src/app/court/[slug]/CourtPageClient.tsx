"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import JudgmentCarousel from "@/components/JudgmentCarousel";
import SittingCard from "@/components/SittingCard";
import { apiClient, CourtStats } from "@/lib/api";
import { Judgment, CourtSitting } from "@/lib/types";
import { SLUG_TO_COURT, useCourt, type Court } from "@/lib/court-context";
import { useTracking } from "@/lib/tracking-context";
import { Calendar, FileText, ArrowRight, ArrowLeft } from "lucide-react";
import { CourtIcon } from "@/components/icons";

const COURT_DESCRIPTIONS: Record<string, string> = {
  "Supreme Court":
    "Jamaica's highest court of original jurisdiction — presiding over civil, criminal, and constitutional matters of national significance.",
  "Court of Appeal":
    "The intermediate appellate court reviewing decisions of the Supreme Court, with jurisdiction over the most consequential civil and criminal appeals.",
  "Parish Court":
    "The court of first instance in Jamaica's fourteen parishes, handling everyday civil and criminal matters for communities across the island.",
};

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-4 py-4">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="mt-1 text-center text-[11px] text-muted-foreground leading-snug">{label}</span>
    </div>
  );
}

export default function CourtPage() {
  const params = useParams();
  const router = useRouter();
  const { setSelectedCourt } = useCourt();
  const { isTracked, track } = useTracking();
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [stats, setStats] = useState<CourtStats | null>(null);
  const [loading, setLoading] = useState(true);

  const slug = params.slug as string;
  const court = SLUG_TO_COURT[slug] as Court | undefined;

  useEffect(() => {
    if (court) setSelectedCourt(court);
  }, [court, setSelectedCourt]);

  const fetchData = useCallback(async () => {
    if (!court) return;
    setLoading(true);
    try {
      // Compute Monday–Sunday of the current Jamaica week using local date
      const todayStr = new Date().toLocaleDateString("en-CA");
      const [yr, mo, dy] = todayStr.split("-").map(Number);
      const base = new Date(Date.UTC(yr, mo - 1, dy));
      const dow = base.getUTCDay(); // 0 = Sunday
      const daysToMonday = dow === 0 ? 6 : dow - 1;
      const monday = new Date(base);
      monday.setUTCDate(base.getUTCDate() - daysToMonday);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const weekStart = monday.toISOString().split("T")[0];
      const weekEnd = sunday.toISOString().split("T")[0];

      const [jRes, sRes, statsRes] = await Promise.all([
        apiClient.getJudgments({ court }),
        apiClient.getCourtSittings({ court, date_from: weekStart, date_to: weekEnd, limit: 100 }),
        apiClient.getCourtStats(court),
      ]);
      setJudgments(jRes.judgments.slice(0, 6));
      setSittings(sRes.sittings);
      setStats(statsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [court]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!court) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-12 text-center">
            <p className="text-white/70">Court not found.</p>
          </main>
        </div>
      </AuthGuard>
    );
  }

  // sittings is already filtered to the current Jamaica week by fetchData
  const thisWeekSittings = sittings;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-12">
          {/* Back link */}
          <Link
            href="/cases"
            className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Cases
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="mb-2.5 flex items-center gap-2">
              <CourtIcon className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                Jamaica Court System
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {court}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {COURT_DESCRIPTIONS[court]}
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-3 gap-3">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-border bg-card px-4 py-4 flex flex-col items-center gap-2"
                >
                  <div className="h-6 w-10 rounded bg-muted" />
                  <div className="h-2.5 w-20 rounded bg-muted/60" />
                </div>
              ))
            ) : (
              <>
                <StatPill
                  label="Judgments"
                  value={stats?.total_judgments ?? judgments.length}
                  color="text-[#009B3A]"
                />
                <StatPill
                  label="Sittings this week"
                  value={stats?.sittings_this_week ?? thisWeekSittings.length}
                  color="text-[#FED100]"
                />
                <StatPill
                  label="Active judges"
                  value={stats?.active_judges ?? "—"}
                  color="text-blue-400"
                />
              </>
            )}
          </div>

          {/* Latest Judgments Carousel */}
          <div className="mb-8 carousel-container group">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CourtIcon className="h-4 w-4 text-[#009B3A]" />
                <h2 className="text-sm font-semibold text-foreground">Latest Judgments</h2>
              </div>
              <Link
                href={`/cases?court=${slug}`}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                See all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="h-[168px] sm:h-[200px] rounded-2xl border border-border bg-card animate-pulse" />
            ) : judgments.length > 0 ? (
              <JudgmentCarousel judgments={judgments} />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-12">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No judgments for this court</p>
              </div>
            )}
          </div>

          {/* This week's sittings */}
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#FED100]" />
                <h2 className="text-sm font-semibold text-foreground">This Week&apos;s Sittings</h2>
              </div>
              <Link
                href={`/cases?court=${slug}`}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Browse all cases
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl border border-border bg-card"
                  />
                ))}
              </div>
            ) : thisWeekSittings.length > 0 ? (
              <div className="space-y-3">
                {thisWeekSittings.map((sitting) => (
                  <SittingCard
                    key={sitting.id}
                    sitting={sitting}
                    onClick={() => router.push(`/cases/sittings/${sitting.id}`)}
                    isTracked={isTracked(sitting.id, "sitting")}
                    onTrack={(id) => track(id, "sitting")}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-12">
                <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No sittings scheduled this week</p>
              </div>
            )}
          </div>

          {/* Browse all CTA */}
          <div className="flex justify-center pt-2">
            <Link
              href={`/cases?court=${slug}`}
              className="flex items-center gap-2 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/10 px-6 py-3 text-sm font-semibold text-[#009B3A] hover:bg-[#009B3A]/15 transition-colors"
            >
              View All Judgments
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
