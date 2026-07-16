"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import {
  HardDriveDownload,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ShieldCheck,
} from "lucide-react";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatCooldown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function BackupPage() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "rate-limited" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFilename, setLastFilename] = useState("");
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [cooldownInterval, setCooldownInterval] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  const startCooldown = (secs: number) => {
    setCooldownSecs(secs);
    if (cooldownInterval) clearInterval(cooldownInterval);
    const id = setInterval(() => {
      setCooldownSecs((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setStatus("idle");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setCooldownInterval(id);
  };

  const handleDownload = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const result = await apiClient.adminDownloadBackup();

      if (result.retryAfterSecs !== undefined) {
        setStatus("rate-limited");
        startCooldown(result.retryAfterSecs);
        return;
      }

      triggerDownload(result.blob, result.filename);
      setLastFilename(result.filename);
      setStatus("done");
      // Auto-reset after 10 s so the button is usable again visually
      setTimeout(() => setStatus("idle"), 10_000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Database className="h-4 w-4 text-[#009B3A]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#009B3A]">
            Admin
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">Database Backup</h1>
        <p className="mt-1 text-sm text-white/70">
          Download a complete SQL dump of the live database.
        </p>
      </div>

      {/* Info card */}
      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009B3A]" />
          <div>
            <p className="text-sm font-semibold text-white">What's included</p>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              All tables — users, judgments, court sittings, notifications,
              tracked cases, parish cases, config, audit logs, and more.
              Generated live using <code className="font-mono text-[#009B3A]">row_to_json</code>; no shell access required.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-white">Sensitive data</p>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              The dump includes hashed passwords and auth tokens. Store the
              file securely and delete it after use.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
          <div>
            <p className="text-sm font-semibold text-white">Rate limit</p>
            <p className="mt-1 text-xs text-white/50">
              One download every 15 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Download card */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#009B3A]/15">
            <HardDriveDownload className="h-5 w-5 text-[#009B3A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">SQL Dump</p>
            <p className="text-xs text-white/70">
              Plain-SQL file, restorable with{" "}
              <code className="font-mono text-white/60">psql</code>
            </p>
          </div>
        </div>

        {/* Status messages */}
        {status === "done" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/10 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#009B3A]" />
            <div>
              <p className="text-sm font-semibold text-[#009B3A]">
                Download started
              </p>
              <p className="text-xs text-[#009B3A]/70 font-mono mt-0.5">
                {lastFilename}
              </p>
            </div>
          </div>
        )}

        {status === "rate-limited" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3">
            <Clock className="h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-400">
                Rate limited
              </p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Next backup available in{" "}
                <span className="font-mono font-bold">
                  {formatCooldown(cooldownSecs)}
                </span>
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={status === "loading" || status === "rate-limited"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009B3A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#009B3A]/85 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating backup…
            </>
          ) : status === "rate-limited" ? (
            <>
              <Clock className="h-4 w-4" />
              Available in {formatCooldown(cooldownSecs)}
            </>
          ) : (
            <>
              <HardDriveDownload className="h-4 w-4" />
              Download Database Backup
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] text-white/55">
          Generation time scales with database size. Large databases may take
          10–30 seconds.
        </p>
      </div>

      {/* Restore instructions */}
      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3">
          How to restore
        </p>
        <div className="space-y-3 text-xs text-white/50 leading-relaxed">
          <div className="rounded-lg bg-black/30 px-4 py-3 font-mono text-[11px] text-white/60">
            <p className="text-white/60 mb-1"># incremental restore (safe — skips existing rows)</p>
            <p>psql "$DATABASE_URL" &lt; courtwatch_backup_YYYY-MM-DD.sql</p>
          </div>
          <div className="rounded-lg bg-black/30 px-4 py-3 font-mono text-[11px] text-white/60">
            <p className="text-white/60 mb-1"># full replace — uncomment the TRUNCATE line in the file first</p>
            <p>psql "$DATABASE_URL" &lt; courtwatch_backup_YYYY-MM-DD.sql</p>
          </div>
          <p className="text-white/60">
            On Render: set <code className="font-mono">DATABASE_URL</code> to
            your Postgres internal connection string, available in the Render
            dashboard under your database's Info tab.
          </p>
        </div>
      </div>
    </div>
  );
}
