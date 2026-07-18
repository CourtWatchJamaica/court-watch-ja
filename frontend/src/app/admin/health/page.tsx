"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  AdminEmailStats,
  DataQualityCheck,
  ScraperSourceHealth,
} from "@/lib/types";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldQuestion,
  XCircle,
} from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  sc_judgments: "Supreme Court judgments",
  coa_judgments: "Court of Appeal judgments",
  parish_judgments: "Parish Court judgments",
  sc_court_lists: "Supreme Court lists",
  coa_court_lists: "Court of Appeal lists",
  parish_cases: "Parish Court cases",
  news: "Legal news (RSS)",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso + "Z").getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "under an hour ago";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] px-5 py-4">
      <p className={`text-2xl font-bold tabular-nums ${accent && value > 0 ? "text-amber-400" : "text-white"}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] text-white/60">{label}</p>
    </div>
  );
}

export default function AdminHealthPage() {
  const [sources, setSources] = useState<ScraperSourceHealth[]>([]);
  const [emailStats, setEmailStats] = useState<AdminEmailStats | null>(null);
  const [quality, setQuality] = useState<DataQualityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, e, q] = await Promise.all([
        apiClient.adminScraperHealth(),
        apiClient.adminEmailStats(),
        apiClient.adminDataQuality(),
      ]);
      setSources(h.sources);
      setEmailStats(e.stats);
      setQuality(q.checks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load health data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const staleCount = sources.filter((s) => s.stale).length;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <Activity className="h-5 w-5 text-[#009B3A]" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Health</h1>
          <p className="text-xs text-white/70 mt-0.5">
            Scraper sources, email delivery, and data quality at a glance
          </p>
        </div>
        <button
          onClick={load}
          className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 text-xs text-white/70 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && sources.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-white/60 py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* ── Scraper sources ── */}
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">
            Scraper sources{" "}
            {staleCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400 normal-case tracking-normal">
                {staleCount} stale
              </span>
            )}
          </h2>
          <div className="mb-8 grid gap-2 sm:grid-cols-2">
            {sources.map((s) => (
              <div
                key={s.source}
                className={`rounded-lg border px-4 py-3 ${
                  s.stale
                    ? "border-amber-500/30 bg-amber-500/[0.04]"
                    : "border-white/[0.07] bg-[#0e0e1a]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {s.stale ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  ) : s.last_run_success === false ? (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#009B3A] shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-white flex-1">
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </span>
                  <span className="text-[10px] text-white/50 tabular-nums">
                    {s.total_rows.toLocaleString()} rows
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/60">
                  <span>Last new data: {timeAgo(s.last_data_at)}</span>
                  <span>Last run: {timeAgo(s.last_run_at)}</span>
                  {s.last_run_rows !== null && (
                    <span>+{s.last_run_rows} last run</span>
                  )}
                  {s.consecutive_zero_runs >= 5 && (
                    <span className="text-amber-400">
                      {s.consecutive_zero_runs} runs with 0 new rows
                    </span>
                  )}
                </div>
                {s.stale && (
                  <p className="mt-1.5 text-[11px] text-amber-400/90">
                    No new rows in over {s.stale_after_days} days — the source site may have changed.
                  </p>
                )}
                {s.last_run_error && (
                  <p className="mt-1.5 text-[11px] text-red-400/90 truncate" title={s.last_run_error}>
                    {s.last_run_error}
                  </p>
                )}
              </div>
            ))}
            {sources.every((s) => s.last_run_at === null) && (
              <p className="sm:col-span-2 text-[11px] text-white/50">
                Run history appears after the next scheduled scrape — data freshness above is live already.
              </p>
            )}
          </div>

          {/* ── Email delivery ── */}
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">
            <Mail className="h-3 w-3" /> Email delivery
          </h2>
          {emailStats && (
            <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Sent today" value={emailStats.sent_today} />
              <StatTile label="Sent last 7 days" value={emailStats.sent_7d} />
              <StatTile label="Pending dispatch" value={emailStats.pending} />
              <StatTile label="Expired unsent (7d)" value={emailStats.retired_7d} accent />
            </div>
          )}

          {/* ── Data quality ── */}
          <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">
            <ShieldQuestion className="h-3 w-3" /> Data quality
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quality.map((c) => (
              <StatTile key={c.key} label={c.label} value={c.count} accent />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
