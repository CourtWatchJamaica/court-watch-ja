"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { AdminDashboardStats, SystemConfigEntry } from "@/lib/types";
import {
  Users,
  Cpu,
  Settings,
  RefreshCw,
  Scale,
  TrendingUp,
  Bell,
  Clock,
  Wrench,
  Loader2,
  AlertTriangle,
  UserCheck,
  Mail,
  CalendarDays,
  BookOpen,
  Gavel,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ScraperStatus } from "@/lib/types";

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
        <p className="text-[10px] text-white/70 mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-[9px] text-white/55 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] hover:border-white/[0.12] transition-colors">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a]">{inner}</div>;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#0e0e1a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 11,
};

function WeekLabel(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("en-JM", { month: "short", day: "numeric" });
}

function DayLabel(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("en-JM", { month: "short", day: "numeric" });
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
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
      const [statsRes, configRes, scraperRes] = await Promise.all([
        apiClient.adminGetStats(),
        apiClient.adminGetConfig(),
        apiClient.adminGetScraperState(),
      ]);
      setStats(statsRes);
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

  const backupEntry = config.find((e) => e.key === "backup_last_date");
  const backupDate = backupEntry?.value ?? null;
  const backupStale = (() => {
    if (!backupDate) return true;
    return (Date.now() - new Date(backupDate).getTime()) / 86400000 > 7;
  })();
  const formatBackupAge = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const usersPerWeek = (stats?.users_per_week ?? []).map((d) => ({
    ...d,
    label: WeekLabel(d.week),
    count: Number(d.count),
  }));
  const emailsPerDay = (stats?.emails_per_day ?? []).map((d) => ({
    ...d,
    label: DayLabel(d.day),
    count: Number(d.count),
  }));

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
        <p className="mt-1 text-sm text-white/70">System status at a glance.</p>
      </div>

      {/* Backup reminder */}
      {!loading && isSuperAdmin && backupStale && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="flex-1 text-sm text-amber-400/90">
            {backupDate
              ? `Last DB backup: ${formatBackupAge(backupDate)} — consider exporting a fresh backup.`
              : "No database backup on record — export a backup and set backup_last_date in system config."}
          </p>
          <a
            href="https://dashboard.render.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/20 transition-colors"
          >
            Render →
          </a>
        </div>
      )}

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg border border-white/[0.06] bg-[#0e0e1a]" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatTile label="Total Users" value={stats.user_count.toLocaleString()} icon={Users} href="/admin/users" accent="bg-blue-500/20" />
          <StatTile label="Judgments" value={stats.judgment_count.toLocaleString()} icon={BookOpen} href="/admin/data" accent="bg-[#009B3A]/20" />
          <StatTile label="Sittings" value={stats.sittings_count.toLocaleString()} icon={Gavel} href="/admin/data" accent="bg-cyan-500/20" />
          <StatTile label="Last Scrape" value={scraper?.last_sc_scraped ? new Date(scraper.last_sc_scraped).toLocaleDateString("en-JM", { month: "short", day: "numeric" }) : "—"} icon={Cpu} href="/admin/scraper" accent="bg-[#FED100]/15" />
          <StatTile label="Active Trackers" value={stats.active_trackers.toLocaleString()} icon={UserCheck} accent="bg-indigo-500/20" />
          <StatTile label="Emails This Month" value={stats.emails_sent_this_month.toLocaleString()} icon={Mail} accent="bg-purple-500/20" />
          <StatTile label="Upcoming Sittings" value={stats.upcoming_sittings.toLocaleString()} icon={CalendarDays} href="/admin/data" accent="bg-[#FED100]/15" />
          <StatTile label="Unread Notifs" value={stats.pending_notifications.toLocaleString()} icon={Bell} accent={stats.pending_notifications > 0 ? "bg-amber-400/20" : "bg-white/[0.06]"} />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-5 mb-6">
        {/* New users per week */}
        <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">New Users / Week</h2>
            <span className="ml-auto text-[10px] text-white/55">last 8 weeks</span>
          </div>
          {loading ? (
            <div className="h-36 animate-pulse rounded-xl bg-white/[0.03]" />
          ) : usersPerWeek.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-white/50">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={usersPerWeek} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="New users" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Emails per day */}
        <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Emails Sent / Day</h2>
            <span className="ml-auto text-[10px] text-white/55">last 14 days</span>
          </div>
          {loading ? (
            <div className="h-36 animate-pulse rounded-xl bg-white/[0.03]" />
          ) : emailsPerDay.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-white/50">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={emailsPerDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="Emails" fill="#a855f7" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row: scraper + config */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#FED100]" />
              <h2 className="text-sm font-semibold text-white">Scraper</h2>
            </div>
            <Link href="/admin/scraper" className="text-[11px] text-white/70 hover:text-white/90 transition-colors">
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
                    <p className="text-[10px] text-white/65 mt-0.5">{s.label}</p>
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

        <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">System Config</h2>
            </div>
            <Link href="/admin/config" className="text-[11px] text-white/70 hover:text-white/90 transition-colors">
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
              <p className="text-xs text-white/55 py-4 text-center">No config entries</p>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance mode */}
      {isSuperAdmin && (
        <div className="mt-6 rounded-lg border border-white/[0.07] bg-[#0e0e1a] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${maintenance ? "bg-[#FED100]/15" : "bg-white/[0.06]"}`}>
                <Wrench className={`h-4 w-4 ${maintenance ? "text-[#FED100]" : "text-white/60"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Maintenance Mode</p>
                <p className="text-xs text-white/70 mt-0.5">
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
              {togglingMaintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : maintenance ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      )}

      {/* Quick nav to logs */}
      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/admin/logs"
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/60 transition-colors"
        >
          <Clock className="h-3 w-3" />
          View Admin Logs →
        </Link>
        <button
          onClick={fetchAll}
          className="min-h-[44px] flex items-center gap-1.5 px-2 text-xs text-white/50 hover:text-white/60 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}
