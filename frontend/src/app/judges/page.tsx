"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import JudgeCard3D from "@/components/JudgeCard3D";
import { apiClient } from "@/lib/api";
import { Judge } from "@/lib/types";
import { Users } from "lucide-react";

function SkeletonJudgeCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20">
      <div className="h-[200px] bg-white/[0.04]" />
      <div className="space-y-2 p-4">
        <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
        <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

export default function JudgesPage() {
  const router = useRouter();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJudges = async () => {
      try {
        const { judges: data } = await apiClient.getJudges();
        setJudges(data);
      } catch (error) {
        console.error("Failed to fetch judges:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJudges();
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#07070f]">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">
          {/* ── Header ── */}
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                Judicial Directory
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Jamaican Judiciary
            </h1>
            <p className="mt-1.5 text-sm text-white/40">
              {loading
                ? "Loading registry…"
                : `${judges.length} judge${judges.length !== 1 ? "s" : ""} in the registry`}
            </p>
          </div>

          {/* ── Grid ── */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonJudgeCard key={i} />
              ))
            ) : judges.length > 0 ? (
              judges.map((judge) => (
                <JudgeCard3D
                  key={judge.id}
                  judge={judge}
                  onClick={() => router.push(`/judges/${judge.id}`)}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-black/15 py-20 text-center">
                <Users className="mb-4 h-12 w-12 text-white/10" />
                <p className="text-sm text-white/30">
                  No judges found in the registry
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
