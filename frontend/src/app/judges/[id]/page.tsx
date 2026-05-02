"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import CaseCard from "@/components/CaseCard";
import { apiClient } from "@/lib/api";
import { Judge, Judgment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Scale, FileText } from "lucide-react";

/* ── Skeletons ── */

function SkeletonHeader() {
  return (
    <div className="animate-pulse mb-10">
      <div className="h-3 w-24 rounded bg-muted mb-6" />
      <div className="flex items-start gap-5">
        <div className="h-16 w-16 rounded-2xl bg-muted shrink-0" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-3.5 w-1/3 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-8 h-px bg-muted" />
      <div className="mt-6 h-4 w-40 rounded bg-muted" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex justify-between gap-3">
        <div className="h-3.5 w-2/3 rounded bg-muted" />
        <div className="h-5 w-20 rounded-md bg-muted shrink-0" />
      </div>
      <div className="space-y-2 pt-1">
        <div className="h-2.5 w-1/2 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}

/* ── Page ── */

export default function JudgeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [judge, setJudge] = useState<Judge | null>(null);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchJudge = async () => {
      try {
        const data = await apiClient.getJudge(id);
        setJudge(data.judge);
        setJudgments(data.judgments);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchJudge();
  }, [id]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">
          {loading ? (
            <>
              <SkeletonHeader />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </>
          ) : notFound || !judge ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Scale className="mb-4 h-12 w-12 text-muted-foreground/25" />
              <p className="text-lg font-semibold mb-1">Judge not found</p>
              <p className="text-sm text-muted-foreground mb-6">
                This judge could not be found in the registry.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/judges")}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to Judges
              </Button>
            </div>
          ) : (
            <>
              {/* Back */}
              <button
                onClick={() => router.back()}
                className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              {/* Judge header */}
              <div className="mb-8">
                <div className="flex items-start gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
                    <Scale className="h-8 w-8 text-[#009B3A]" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                        Judge Profile
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {judge.name}
                    </h1>
                    {judge.court && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 text-[#009B3A]/70" />
                        {judge.court}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6 h-px bg-border" />

              {/* Judgments */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#009B3A]" />
                  <h2 className="text-sm font-semibold">
                    Judgments
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({judgments.length})
                    </span>
                  </h2>
                </div>
              </div>

              {judgments.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {judgments.map((judgment) => (
                    <CaseCard
                      key={judgment.id}
                      judgment={judgment}
                      onClick={() => router.push(`/cases/${judgment.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/50 py-16 text-center">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">
                    No judgments on record for this judge
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
