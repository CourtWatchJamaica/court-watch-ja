"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { Judgment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useTracking } from "@/lib/tracking-context";
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  FileText,
  Download,
  Bookmark,
  BookmarkCheck,
  Scale,
} from "lucide-react";

function DetailSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden animate-pulse">
      <div className="p-6 border-b border-white/[0.06] space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-28 rounded-full bg-white/[0.06]" />
          <div className="h-6 w-16 rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-7 w-3/4 rounded bg-white/[0.07]" />
        <div className="h-3.5 w-1/4 rounded bg-white/[0.04]" />
      </div>
      <div className="p-6 grid sm:grid-cols-2 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-12 rounded bg-white/[0.04]" />
            <div className="h-4 w-40 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="px-6 pb-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          <div className="h-3 w-16 rounded bg-white/[0.04]" />
          <div className="h-3 w-full rounded bg-white/[0.06]" />
          <div className="h-3 w-4/5 rounded bg-white/[0.05]" />
          <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(true);
  const { isTracked, track } = useTracking();

  useEffect(() => {
    apiClient
      .getJudgment(params.id as string)
      .then(({ judgment: data }) => setJudgment(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const tracked = judgment ? isTracked(judgment.id, "judgment") : false;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-12">
          <button
            onClick={() => router.back()}
            className="mb-7 flex items-center gap-1.5 text-[12px] font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          {loading ? (
            <DetailSkeleton />
          ) : !judgment ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#0d0d1a] py-16 text-center">
              <p className="text-sm text-white/40">Case not found.</p>
            </div>
          ) : (
            <div className="rounded-2xl border-l-[3px] border-l-[#009B3A] border-t border-r border-b border-white/[0.08] bg-[#0d0d1a] overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {judgment.court && (
                        <span className="flex items-center gap-1.5 rounded-full bg-[#009B3A]/12 border border-[#009B3A]/25 px-2.5 py-1 text-[10px] font-semibold text-[#009B3A]">
                          <Scale className="h-3 w-3" />
                          {judgment.court}
                        </span>
                      )}
                      <Badge className="bg-white/[0.06] text-white/40 border border-white/[0.08] text-[10px] font-mono px-2.5 h-6 rounded-full">
                        Judgment
                      </Badge>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                      {judgment.title || judgment.case_number}
                    </h1>
                    {judgment.case_number && judgment.title && (
                      <p className="mt-2 font-mono text-[11px] text-[#009B3A]/50 tracking-wider">
                        {judgment.case_number}
                      </p>
                    )}
                  </div>

                  {/* Track button */}
                  {tracked ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/10 px-4 py-2.5 text-[12px] font-semibold text-[#009B3A]">
                      <BookmarkCheck className="h-3.5 w-3.5" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => track(judgment.id, "judgment")}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-[12px] font-semibold text-white/50 hover:border-[#009B3A]/40 hover:text-[#009B3A] hover:bg-[#009B3A]/[0.08] transition-colors"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      Track case
                    </button>
                  )}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="p-6 grid sm:grid-cols-2 gap-6">
                {judgment.judge_name && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-1.5">
                      Judge
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-white/75">
                      <User className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      {judgment.judge_name}
                    </div>
                  </div>
                )}
                {judgment.date && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-1.5">
                      Date
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-white/75">
                      <Calendar className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      {new Date(judgment.date).toLocaleDateString("en-JM", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                )}
                {judgment.court && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-1.5">
                      Court
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-white/75">
                      <Building2 className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      {judgment.court}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              {judgment.summary_text && (
                <div className="px-6 pb-6">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-3.5 w-3.5 text-[#009B3A]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25">
                        Summary
                      </p>
                    </div>
                    <p className="text-[13px] text-white/65 leading-relaxed">
                      {judgment.summary_text}
                    </p>
                  </div>
                </div>
              )}

              {/* PDF download */}
              <div className="px-6 pb-6">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}/pdf/judgment/${judgment.id}`}
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/10 px-4 py-2.5 text-[12px] font-semibold text-[#009B3A] hover:bg-[#009B3A]/15 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Summary (PDF)
                  <span className="font-mono text-[9px] font-normal text-[#009B3A]/50 group-hover:text-[#009B3A]/70 transition-colors">
                    CourtWatch JA
                  </span>
                </a>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.05]">
                <p className="text-[10px] text-white/20">
                  Created {new Date(judgment.created_at).toLocaleDateString("en-JM")} · Updated{" "}
                  {new Date(judgment.updated_at).toLocaleDateString("en-JM")}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
