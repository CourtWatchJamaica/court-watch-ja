"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import CaseCard from "@/components/CaseCard";
import { apiClient } from "@/lib/api";
import { Judgment, UserCase } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Bookmark,
  TrendingUp,
  Scale,
  ArrowRight,
  Plus,
} from "lucide-react";

/* ── Stat card — always dark regardless of theme ── */
function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] px-5 py-4">
      <div className={`rounded-xl p-2.5 ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-white leading-none">{value}</p>
        <p className="mt-1 text-[11px] text-white/45 leading-none">{label}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-4 space-y-3 animate-pulse">
      <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
      <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
      <div className="h-2.5 w-2/3 rounded bg-white/[0.04]" />
    </div>
  );
}

/* ── Page ── */

export default function Dashboard() {
  const router = useRouter();
  const [latestJudgments, setLatestJudgments] = useState<Judgment[]>([]);
  const [trackedCases, setTrackedCases] = useState<UserCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [judgmentsRes, casesRes] = await Promise.all([
          apiClient.getJudgments(),
          apiClient.getUserCases(),
        ]);
        setLatestJudgments(judgmentsRes.judgments.slice(0, 5));
        setTrackedCases(casesRes.cases);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <AuthGuard>
      {/* bg-background adapts to theme; inner sections stay dark explicitly */}
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">

          {/* ── Header — theme-aware ── */}
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                CourtWatch JA
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Good morning, Counsellor
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-JM", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* ── Stats row — forced dark ── */}
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label="Total Judgments"
              value={loading ? "—" : `${latestJudgments.length}+`}
              icon={FileText}
              iconBg="bg-[#009B3A]/15"
              iconColor="text-[#009B3A]"
            />
            <StatCard
              label="Tracked Cases"
              value={loading ? "—" : trackedCases.length}
              icon={Bookmark}
              iconBg="bg-[#FED100]/12"
              iconColor="text-[#FED100]"
            />
            <div className="col-span-2 lg:col-span-1">
              <StatCard
                label="Live Updates"
                value="Active"
                icon={TrendingUp}
                iconBg="bg-blue-500/15"
                iconColor="text-blue-400"
              />
            </div>
          </div>

          {/* ── Two-column grid — cards stay dark ── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Latest Judgments */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#009B3A]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Latest Judgments
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/cases")}
                  className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2.5">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))
                ) : latestJudgments.length > 0 ? (
                  latestJudgments.map((judgment) => (
                    <CaseCard
                      key={judgment.id}
                      judgment={judgment}
                      onClick={() => router.push(`/cases/${judgment.id}`)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-14 text-center">
                    <FileText className="mb-3 h-10 w-10 text-white/10" />
                    <p className="text-sm text-white/30">No judgments found</p>
                  </div>
                )}
              </div>
            </section>

            {/* Tracked Cases */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-[#FED100]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Tracked Cases
                    {!loading && trackedCases.length > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({trackedCases.length})
                      </span>
                    )}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/cases")}
                  className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> Track more
                </Button>
              </div>

              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))
                ) : trackedCases.length > 0 ? (
                  trackedCases.map((userCase) => (
                    <div
                      key={userCase.id}
                      className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] bg-[#0d0d1a] px-4 py-3 transition-all duration-200 hover:border-[#FED100]/25 hover:bg-[#FED100]/[0.04]"
                      onClick={() => router.push(`/cases/${userCase.case_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FED100]/10">
                          <Bookmark className="h-3.5 w-3.5 text-[#FED100]/80" />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-white/75 transition-colors group-hover:text-white">
                            Case #{userCase.case_id}
                          </p>
                          <p className="text-[11px] text-white/35">
                            Tracked{" "}
                            {new Date(userCase.created_at).toLocaleDateString(
                              "en-JM",
                              { month: "short", day: "numeric", year: "numeric" },
                            )}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-white/15 transition-colors group-hover:text-[#FED100]/50" />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-14 text-center">
                    <Bookmark className="mb-3 h-10 w-10 text-white/10" />
                    <p className="mb-5 text-sm text-white/30">
                      No tracked cases yet
                    </p>
                    <Button
                      size="sm"
                      onClick={() => router.push("/cases")}
                      className="h-8 bg-[#009B3A] px-4 text-xs text-white hover:bg-[#009B3A]/85"
                    >
                      Browse Cases
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
