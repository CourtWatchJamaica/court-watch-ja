"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import JudicialConstellation from "@/components/JudicialConstellation";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { Judge, JudgeConnection } from "@/lib/types";
import { Users } from "lucide-react";

function ConstellationSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Search bar skeleton */}
      <div className="px-1 pb-4 shrink-0">
        <Skeleton className="h-11 w-full rounded-xl bg-white/[0.05]" />
      </div>
      {/* Canvas skeleton */}
      <div className="relative flex-1 rounded-lg overflow-hidden border border-white/[0.05] bg-[#050510]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/[0.08] border-t-[#009B3A]" />
          <p className="text-[11px] text-white/50">Loading judicial constellation…</p>
        </div>
      </div>
      {/* Legend skeleton */}
      <div className="flex gap-4 px-5 py-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-3 w-24 rounded bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function JudgesPage() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [connections, setConnections] = useState<JudgeConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch judges and connections independently so a failure in one
    // cannot block or mask the other. Loading clears when judges settle.
    apiClient
      .getJudges()
      .then((res) => {
        console.log("[Constellation] judges received:", res.judges?.length ?? 0);
        setJudges(res.judges ?? []);
      })
      .catch((err) => console.error("[Constellation] getJudges failed:", err))
      .finally(() => setLoading(false));

    apiClient
      .getJudgeConnections()
      .then((res) => setConnections(res.connections ?? []))
      .catch((err) => console.error("[Constellation] getJudgeConnections failed:", err));
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#080810]">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-10">
          {/* ── Header ── */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                Judicial Directory
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                The Judicial Constellation
              </h1>
              {!loading && (
                <p className="text-[11px] text-white/60 shrink-0 pb-0.5">
                  {judges.length} judge{judges.length !== 1 ? "s" : ""} · {connections.length} connection{connections.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <p className="mt-1 text-sm text-white/65">
              Each star is a judge — size reflects caseload, colour reflects court.
            </p>
          </div>

          {/* ── Constellation or skeleton ── */}
          {loading ? (
            <ConstellationSkeleton />
          ) : (
            <JudicialConstellation judges={judges} connections={connections} />
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
