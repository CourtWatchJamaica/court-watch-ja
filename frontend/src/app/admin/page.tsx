"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ScraperStatus, SystemConfigEntry } from "@/lib/types";
import {
  Users,
  Database,
  Cpu,
  Settings,
  RefreshCw,
  Scale,
  TrendingUp,
  Bell,
  Clock,
  Wrench,
  Loader2,
} from "lucide-react";
import Link from "next/link";

function getRoleFromToken(): string | null {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return null;
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64))?.role ?? null;
  } catch {
    return null;
  }
}

interface OverviewStats {
  userCount: number;
  judgmentCount: number;
  sittingCount: number;
  pendingNotifications: number;
  lastScrapeAt: string | null;
}

function StatTile({
  label,
  value,
  icon: Icon,
  href,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  accent: string;
  sub?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 p-4">
      <div className={`rounded-xl p-2.5 ${accent}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-white leading-tight truncate">{value}</p>
        <p className="text-[10px] text-white/40 mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-[9px] text-white/25 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] hover:border-white/[0.12] transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a]">{inner}</div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [scraper, setScraper] = useState<ScraperStatus | null>(null);
  const [config, setConfig] = useState<SystemConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const role = getRoleFromToken();
  const isSuperAdmin = role === "super_admin";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, judgmentsRes, sittingsRes, configRes, scraperRes, statsRes] =
        await Promise.all([
          apiClient.adminListUsers(),
          apiClient.adminListJudgments(1, 1),
          apiClient.adminListSittings(1, 1),
          apiClient.adminGetConfig(),
          apiClient.adminGetScraperState(),
          apiClient.adminGetStats(),
        ]);
      setStats({
        userCount: usersRes.users.length,
        judgmentCount: judgmentsRes.total,
        sittingCount: sittingsRes.total,
        pendingNotifications: statsRes.pending_notifications,
        lastScrapeAt: statsRes.last_scrape_at,
      });
      setConfig(configRes.config);
      setScraper(scraperRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMaintenance = useCallback(async () => {
    try {
      const { maintenance_mode } = await apiClient.getMaintenanceStatus();
      setMaintenance(maintenance_mode);
    } catch {
      setMaintenance(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    if (isSuperAdmin) fetchMaintenance();
  }, [fetchAll, fetchMaintenance, isSuperAdmin]);

  const handleToggleMaintenance = async () => {
    if (maintenance === null) return;
    setTogglingMaintenance(true);
    try {
      const { maintenance_mode } = await apiClient.adminSetMaintenance(!maintenance);
      setMaintenance(maintenance_mode);
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const formatScrapeTime = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-JM", { month: "short", day: "numeric" });
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#009B3A]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#009B3A]">
            CourtWatch JA
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
        <p className="mt-1 text-sm text-white/40">System status at a glance.</p>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl border border-white/[0.06] bg-[#0d0d1a]" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatTile
            label="Users"
            value={stats.userCount}
            icon={Users}
            href="/admin/users"
            accent="bg-blue-500/20"
          />
          <StatTile
            label="Judgments"
            value={stats.judgmentCount.toLocaleString()}
            icon={Database}
            href="/admin/data"
            accent="bg-[#009B3A]/20"
          />
          <StatTile
            label="Sittings"
            value={stats.sittingCount.toLocaleString()}
            icon={TrendingUp}
            href="/admin/data"
            accent="bg-[#FED100]/15"
          />
          <StatTile
            label="Last Scrape"
            value={formatScrapeTime(stats.lastScrapeAt)}
            icon={Clock}
            href="/admin/scraper"
            accent="bg-purple-500/20"
            sub={
              stats.lastScrapeAt
                ? new Date(stats.lastScrapeAt).toLocaleTimeString("en-JM", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : undefined
            }
          />
          <StatTile
            label="Pending Notifs"
            value={stats.pendingNotifications}
            icon={Bell}
            accent={stats.pendingNotifications > 0 ? "bg-amber-400/20" : "bg-white/[0.06]"}
          />
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Scraper status */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#FED100]" />
              <h2 className="text-sm font-semibold text-white">Scraper</h2>
            </div>
            <Link href="/admin/scraper" className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
              Manage →
            </Link>
          </div>
          {scraper ? (
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${scraper.is_running ? "bg-[#009B3A] animate-pulse" : "bg-white/20"}`} />
                <span className="text-white/60">{scraper.is_running ? "Running" : "Idle"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: "SC PDFs", value: scraper.processed_sc_count },
                  { label: "CoA PDFs", value: scraper.processed_coa_count },
                  { label: "Parish PDFs", value: scraper.processed_parish_count },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-black/20 px-3 py-2 text-center">
                    <p className="text-base font-bold text-white">{s.value}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {scraper.pdf_skipped_count > 0 && (
                <p className="text-xs text-amber-400/80 mt-2">
                  {scraper.pdf_skipped_count} PDF(s) permanently skipped
                </p>
              )}
            </div>
          ) : (
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />
          )}
        </div>

        {/* Config quick-view */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">System Config</h2>
            </div>
            <Link href="/admin/config" className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
              Edit →
            </Link>
          </div>
          <div className="space-y-2">
            {config.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                <span className="font-mono text-[11px] text-white/50">{entry.key}</span>
                <span className="font-mono text-[11px] text-[#009B3A]">{entry.value}</span>
              </div>
            ))}
            {config.length === 0 && (
              <p className="text-xs text-white/25 py-4 text-center">No config entries</p>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance mode — super_admin only */}
      {isSuperAdmin && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${maintenance ? "bg-[#FED100]/15" : "bg-white/[0.06]"}`}>
                <Wrench className={`h-4 w-4 ${maintenance ? "text-[#FED100]" : "text-white/30"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Maintenance Mode</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {maintenance
                    ? "Site is hidden — only admins can access it"
                    : "Site is live and accessible to all users"}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleMaintenance}
              disabled={togglingMaintenance || maintenance === null}
              className={`min-h-[44px] min-w-[44px] shrink-0 flex items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
                maintenance
                  ? "bg-[#009B3A] text-white hover:bg-[#009B3A]/85"
                  : "bg-[#FED100]/15 border border-[#FED100]/30 text-[#FED100] hover:bg-[#FED100]/25"
              }`}
            >
              {togglingMaintenance ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : maintenance ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={fetchAll}
          className="min-h-[44px] flex items-center gap-1.5 px-2 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}
