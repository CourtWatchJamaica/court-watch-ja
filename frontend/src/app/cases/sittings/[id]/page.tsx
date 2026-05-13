"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { CourtSitting } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useTracking } from "@/lib/tracking-context";
import {
  ArrowLeft,
  Calendar,
  Download,
  User,
  Building2,
  Clock,
  Scale,
  Users,
} from "lucide-react";
import { VerdictIcon, VerdictCheckIcon } from "@/components/icons";

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-JM", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function DetailSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="p-6 border-b border-white/[0.06] space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-28 rounded-full bg-white/[0.06]" />
          <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-7 w-3/4 rounded bg-white/[0.07]" />
        <div className="h-3.5 w-1/4 rounded bg-white/[0.04]" />
      </div>
      <div className="p-6 grid sm:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-12 rounded bg-white/[0.04]" />
            <div className="h-4 w-40 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SittingDetailPage() {
  const params = useParams();
  const [sitting, setSitting] = useState<CourtSitting | null>(null);
  const [loading, setLoading] = useState(true);
  const { isTracked, track } = useTracking();

  useEffect(() => {
    apiClient
      .getCourtSitting(Number(params.id))
      .then(({ sitting: data }) => setSitting(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const tracked = sitting ? isTracked(sitting.id, "sitting") : false;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-12">
          <Link
            href="/cases?tab=sittings"
            className="mb-7 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-600 hover:text-amber-700 dark:text-[#FED100]/70 dark:hover:text-[#FED100] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Court Lists
          </Link>

          {loading ? (
            <DetailSkeleton />
          ) : !sitting ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center">
              <p className="text-sm text-muted-foreground">Sitting not found.</p>
            </div>
          ) : (
            <div className="rounded-2xl border-l-[3px] border-l-[#FED100] border-t border-r border-b border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {sitting.court_division && (
                        <span className="flex items-center gap-1.5 rounded-full bg-[#009B3A]/12 border border-[#009B3A]/25 px-2.5 py-1 text-[10px] font-semibold text-[#009B3A]">
                          <Scale className="h-3 w-3" />
                          {sitting.court_division}
                        </span>
                      )}
                      {sitting.event_type && (
                        <Badge className="bg-[#FED100]/10 text-[#FED100] border border-[#FED100]/25 text-[10px] font-medium px-2.5 h-6 rounded-full">
                          {sitting.event_type}
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                      {sitting.title || sitting.case_number || "Untitled Sitting"}
                    </h1>
                    {sitting.case_number && sitting.title && (
                      <p className="mt-2 font-mono text-[11px] text-[#FED100]/50 tracking-wider">
                        {sitting.case_number}
                      </p>
                    )}
                  </div>

                  {/* Track button */}
                  {tracked ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#FED100]/30 bg-[#FED100]/10 px-4 py-2.5 text-[12px] font-semibold text-[#FED100]">
                      <VerdictCheckIcon className="h-3.5 w-3.5" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => track(sitting.id, "sitting")}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-semibold text-muted-foreground hover:border-[#FED100]/40 hover:text-[#FED100] hover:bg-[#FED100]/[0.08] transition-colors"
                    >
                      <VerdictIcon className="h-3.5 w-3.5" />
                      Track sitting
                    </button>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="p-6 grid sm:grid-cols-2 gap-6">
                {sitting.judge_name && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                      Judge
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-foreground/75">
                      <User className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      {sitting.judge_name}
                    </div>
                  </div>
                )}
                {sitting.event_date && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                      Date
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-foreground/75">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      {formatDate(sitting.event_date)}
                    </div>
                  </div>
                )}
                {sitting.event_time && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                      Time
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-foreground/75">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      {formatTime(sitting.event_time)}
                    </div>
                  </div>
                )}
                {sitting.court_division && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                      Division
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-foreground/75">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      {sitting.court_division}
                    </div>
                  </div>
                )}
                {sitting.lawyers && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                      Counsel
                    </p>
                    <div className="flex items-start gap-2 text-[13px] text-foreground/65 leading-relaxed">
                      <Users className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                      {sitting.lawyers}
                    </div>
                  </div>
                )}
              </div>

              {/* Court list PDF download */}
              <div className="px-6 pb-6">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}/pdf/sitting/${sitting.id}`}
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-[#FED100]/25 bg-[#FED100]/10 px-4 py-2.5 text-[12px] font-semibold text-[#FED100] hover:bg-[#FED100]/15 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Summary (PDF)
                  <span className="font-mono text-[9px] font-normal text-[#FED100]/50 group-hover:text-[#FED100]/70 transition-colors">
                    CourtWatch JA
                  </span>
                </a>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border">
                <p className="text-[10px] text-muted-foreground/50">
                  Listed {new Date(sitting.created_at).toLocaleDateString("en-JM")}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
