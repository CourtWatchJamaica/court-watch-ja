"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ScraperStatus } from "@/lib/types";
import {
  Cpu,
  Play,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ExternalLink,
  SkipForward,
  RotateCcw,
} from "lucide-react";

function StatBox({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/35 mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ count }: { count: number }) {
  if (count >= 3)
    return (
      <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
        {count}× failed
      </span>
    );
  if (count >= 2)
    return (
      <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
        {count}× failed
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-white/40">
      {count}× failed
    </span>
  );
}

export default function AdminScraperPage() {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await apiClient.adminGetScraperState();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scraper state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleTrigger = async () => {
    setTriggering(true);
    setError(null);
    try {
      const result = await apiClient.adminTriggerScraper();
      showToast(result.message);
      setTimeout(fetchStatus, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to trigger scraper");
    } finally {
      setTriggering(false);
    }
  };

  // Remove from skip list → scraper will retry it
  const handleRetry = async (url: string) => {
    setActionUrl(url);
    try {
      await apiClient.adminRemoveSkippedPdf(url);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              pdf_skipped: prev.pdf_skipped.filter((u) => u !== url),
              pdf_skipped_count: prev.pdf_skipped_count - 1,
              pdf_failures: Object.fromEntries(
                Object.entries(prev.pdf_failures).filter(([k]) => k !== url),
              ),
            }
          : prev,
      );
      showToast("Removed from skip list — will retry on next run");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retry URL");
    } finally {
      setActionUrl(null);
    }
  };

  // Clear failure record → scraper will retry it
  const handleRetryFailure = async (url: string) => {
    setActionUrl(url);
    try {
      await apiClient.adminRemoveSkippedPdf(url);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              pdf_failures: Object.fromEntries(
                Object.entries(prev.pdf_failures).filter(([k]) => k !== url),
              ),
            }
          : prev,
      );
      showToast("Failure cleared — URL will be retried");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear failure");
    } finally {
      setActionUrl(null);
    }
  };

  // Add to skip list permanently
  const handleSkipPermanently = async (url: string) => {
    setActionUrl(url + "__skip");
    try {
      await apiClient.adminSkipPdf(url);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              pdf_failures: Object.fromEntries(
                Object.entries(prev.pdf_failures).filter(([k]) => k !== url),
              ),
              pdf_skipped: prev.pdf_skipped.includes(url)
                ? prev.pdf_skipped
                : [...prev.pdf_skipped, url],
              pdf_skipped_count: prev.pdf_skipped.includes(url)
                ? prev.pdf_skipped_count
                : prev.pdf_skipped_count + 1,
            }
          : prev,
      );
      showToast("URL permanently skipped");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to skip URL");
    } finally {
      setActionUrl(null);
    }
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("en-JM") : "Never";

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-[#FED100]" />
          <div>
            <h1 className="text-xl font-bold text-white">Scraper Control</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Trigger runs and manage PDF queues
            </p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Status + Trigger */}
      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status?.is_running
                  ? "bg-[#009B3A] animate-pulse"
                  : "bg-white/20"
              }`}
            />
            <span className="text-sm font-medium text-white/70">
              {status?.is_running ? "Scraper is running…" : "Scraper is idle"}
            </span>
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggering || status?.is_running}
            className="flex items-center gap-2 rounded-xl bg-[#009B3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {triggering ? "Starting…" : "Run Now"}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : status ? (
          <div className="grid grid-cols-3 gap-3">
            <StatBox
              label="SC PDFs Processed"
              value={status.processed_sc_count}
              color="text-[#009B3A]"
            />
            <StatBox
              label="CoA PDFs Processed"
              value={status.processed_coa_count}
              color="text-blue-400"
            />
            <StatBox
              label="Parish PDFs Processed"
              value={status.processed_parish_count}
              color="text-[#FED100]"
            />
          </div>
        ) : null}
      </div>

      {/* Pagination state */}
      {status && (
        <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Pagination State
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Next SC Page" value={status.next_judgment_page} />
            <StatBox label="Next CoA Page" value={status.next_appeal_page} />
            <StatBox
              label="Next Parish Page"
              value={status.next_parish_page}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-white/40">
            <div>
              Last SC scraped:{" "}
              <span className="text-white/60">
                {formatDate(status.last_sc_scraped)}
              </span>
            </div>
            <div>
              Last CoA scraped:{" "}
              <span className="text-white/60">
                {formatDate(status.last_coa_scraped)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PDF failures */}
      {status && Object.keys(status.pdf_failures).length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-400/15 bg-[#0d0d1a] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              PDF Download Failures
            </h2>
            <span className="ml-auto rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              {Object.keys(status.pdf_failures).length}
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(status.pdf_failures).map(([url, count]) => (
              <div
                key={url}
                className="flex items-center gap-2 rounded-lg bg-amber-400/[0.04] border border-amber-400/[0.08] px-3 py-2.5"
              >
                <StatusBadge count={count} />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-1 min-w-0 group"
                >
                  <span className="truncate font-mono text-[10px] text-white/40 group-hover:text-white/70 transition-colors">
                    {url}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 text-white/20 group-hover:text-white/50" />
                </a>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRetryFailure(url)}
                    disabled={
                      actionUrl === url || actionUrl === url + "__skip"
                    }
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-white/40 hover:bg-[#009B3A]/10 hover:text-[#009B3A] disabled:opacity-40 transition-colors"
                    title="Clear failure counter — retry on next run"
                  >
                    {actionUrl === url ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Retry
                  </button>
                  <button
                    onClick={() => handleSkipPermanently(url)}
                    disabled={
                      actionUrl === url || actionUrl === url + "__skip"
                    }
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-white/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 transition-colors"
                    title="Add to permanent skip list"
                  >
                    {actionUrl === url + "__skip" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <SkipForward className="h-3 w-3" />
                    )}
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permanently skipped PDFs */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">
            Permanently Skipped PDFs
          </h2>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/40">
            {status?.pdf_skipped_count ?? 0}
          </span>
        </div>

        {!status || status.pdf_skipped.length === 0 ? (
          <p className="text-xs text-white/25 py-6 text-center">
            No skipped PDFs
          </p>
        ) : (
          <div className="space-y-2">
            {status.pdf_skipped.map((url) => (
              <div
                key={url}
                className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5"
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-1 min-w-0 group"
                >
                  <span className="truncate font-mono text-[10px] text-white/40 group-hover:text-white/70 transition-colors">
                    {url}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 text-white/20 group-hover:text-white/50" />
                </a>
                <button
                  onClick={() => handleRetry(url)}
                  disabled={actionUrl === url}
                  className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-white/30 hover:bg-[#009B3A]/10 hover:text-[#009B3A] disabled:opacity-40 transition-colors"
                  title="Remove from skip list — retry on next run"
                >
                  {actionUrl === url ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Retry
                </button>
                <button
                  onClick={() => handleRetry(url)}
                  disabled={actionUrl === url}
                  className="shrink-0 rounded p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 transition-colors"
                  title="Remove from skip list"
                >
                  {actionUrl === url ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-3 shadow-2xl flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#009B3A]" />
          <p className="text-sm text-white/90">{toast}</p>
        </div>
      )}
    </div>
  );
}
