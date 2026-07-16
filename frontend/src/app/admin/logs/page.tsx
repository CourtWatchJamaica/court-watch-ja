"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ActivityLogRow, AdminLog } from "@/lib/types";
import {
  ScrollText,
  RefreshCw,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Bell,
  FileText,
  Calendar,
} from "lucide-react";

// ── Activity log (notifications) ──────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  new_judgment: "bg-[#009B3A]/15 text-[#009B3A]",
  sitting_changed: "bg-[#FED100]/15 text-[#FED100]",
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new_judgment: FileText,
  sitting_changed: Calendar,
};

const TYPE_LABELS: Record<string, string> = {
  new_judgment: "New Judgment",
  sitting_changed: "Sitting Changed",
};

function ActivityTab() {
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { activity: rows } = await apiClient.adminGetActivityLog();
      setActivity(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString("en-JM", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-white/60">Recent notifications sent across the platform</p>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/60 transition-colors h-[36px] px-2"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && activity.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {Object.entries(
            activity.reduce<Record<string, number>>((acc, row) => {
              acc[row.notification_type] = (acc[row.notification_type] ?? 0) + 1;
              return acc;
            }, {}),
          ).map(([type, count]) => (
            <div
              key={type}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${TYPE_COLORS[type] ?? "bg-white/[0.07] text-white/50"}`}
            >
              <Bell className="h-3 w-3" />
              {count} {TYPE_LABELS[type] ?? type}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Type</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">User</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Case</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Time</span>
        </div>

        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3.5 animate-pulse">
                <div className="h-5 w-28 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-40 rounded bg-white/[0.05]" />
                <div className="h-3 w-10 rounded bg-white/[0.04]" />
                <div className="h-3 w-24 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-8 w-8 text-white/10 mb-3" />
            <p className="text-sm text-white/60">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {activity.map((row) => {
              const Icon = TYPE_ICONS[row.notification_type] ?? Bell;
              const colorClass = TYPE_COLORS[row.notification_type] ?? "bg-white/[0.07] text-white/50";
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] items-center gap-2 md:gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${colorClass}`}>
                    <Icon className="h-3 w-3" />
                    {TYPE_LABELS[row.notification_type] ?? row.notification_type}
                  </span>
                  <span className="truncate text-sm text-white/60">{row.email}</span>
                  <span className="font-mono text-[10px] text-white/60">#{row.case_id}</span>
                  <span className="text-xs text-white/60 whitespace-nowrap">{formatTime(row.sent_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && activity.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-white/50">
          Showing the 100 most recent events
        </p>
      )}
    </div>
  );
}

// ── Audit log (admin actions) ──────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  USER_DELETE: "User Delete",
  JUDGMENT_DELETE: "Judgment Delete",
  SITTING_DELETE: "Sitting Delete",
  PROMO_DELETE: "Promo Delete",
};

const ACTION_COLORS: Record<string, string> = {
  USER_DELETE: "bg-red-500/15 text-red-400",
  JUDGMENT_DELETE: "bg-orange-500/15 text-orange-400",
  SITTING_DELETE: "bg-amber-400/15 text-amber-400",
  PROMO_DELETE: "bg-purple-500/15 text-purple-400",
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-JM", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exportCsv(logs: AdminLog[]) {
  const header = ["ID", "Timestamp", "Admin", "Action", "Target Type", "Target ID", "Details", "IP"].join(",");
  const rows = logs.map((l) =>
    [
      l.id,
      new Date(l.created_at).toISOString(),
      `"${l.admin_email}"`,
      l.action,
      l.target_type ?? "",
      l.target_id ?? "",
      `"${l.details ? JSON.stringify(l.details).replace(/"/g, '""') : ""}"`,
      l.ip_address ?? "",
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 50;

function AuditTab() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(
    async (pg: number, from: string, to: string, action: string) => {
      setLoading(true);
      setError(null);
      try {
        const fromISO = from ? new Date(from).toISOString() : undefined;
        const toISO = to ? new Date(to + "T23:59:59").toISOString() : undefined;
        const res = await apiClient.adminGetAuditLogs({
          page: pg,
          limit: PAGE_SIZE,
          from: fromISO,
          to: toISO,
          action: action || undefined,
        });
        setLogs(res.logs);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load audit log");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchLogs(page, fromDate, toDate, actionFilter);
  }, [fetchLogs, page]);

  const applyFilters = () => {
    setPage(1);
    fetchLogs(1, fromDate, toDate, actionFilter);
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setActionFilter("");
    setPage(1);
    fetchLogs(1, "", "", "");
  };

  const filtersActive = fromDate || toDate || actionFilter;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-white/60">Actions taken by admin users</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 h-[36px] px-3 rounded-lg border text-xs transition-colors ${
              filtersActive
                ? "border-[#009B3A]/40 bg-[#009B3A]/10 text-[#009B3A]"
                : "border-white/[0.08] text-white/70 hover:text-white/90"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters{filtersActive ? " (active)" : ""}
          </button>
          <button
            onClick={() => exportCsv(logs)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 h-[36px] px-3 rounded-lg border border-white/[0.08] text-xs text-white/70 hover:text-white/90 transition-colors disabled:opacity-30"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => fetchLogs(page, fromDate, toDate, actionFilter)}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/60 transition-colors h-[36px] px-2"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/70 uppercase tracking-wider">From date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-[36px] rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 focus:outline-none [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/70 uppercase tracking-wider">To date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-[36px] rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 focus:outline-none [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/70 uppercase tracking-wider">Action type</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-[36px] rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 focus:outline-none cursor-pointer"
              >
                <option value="">All actions</option>
                {ALL_ACTIONS.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <button
              onClick={applyFilters}
              className="h-[36px] px-4 rounded-lg bg-[#009B3A] text-xs font-semibold text-white hover:bg-[#009B3A]/85 transition-colors"
            >
              Apply
            </button>
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="h-[36px] px-3 rounded-lg border border-white/[0.08] text-xs text-white/70 hover:text-white/90 transition-colors flex items-center gap-1.5"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mb-4 flex items-center gap-3 text-xs text-white/60">
          <span>{total.toLocaleString()} log entr{total === 1 ? "y" : "ies"}</span>
          {filtersActive && <span className="text-[#009B3A]/60">• filtered</span>}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Time</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Action</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Admin</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Target</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Details</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">IP</span>
        </div>

        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3.5 animate-pulse">
                <div className="h-3 w-24 rounded bg-white/[0.05]" />
                <div className="h-5 w-28 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-40 rounded bg-white/[0.04]" />
                <div className="h-3 w-16 rounded bg-white/[0.04]" />
                <div className="h-3 w-28 rounded bg-white/[0.03]" />
                <div className="h-3 w-20 rounded bg-white/[0.03]" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ScrollText className="h-8 w-8 text-white/10 mb-3" />
            <p className="text-sm text-white/60">No audit log entries yet</p>
            <p className="text-xs text-white/15 mt-1">Admin actions (deletes, etc.) will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-1 md:grid-cols-[auto_auto_1fr_auto_auto_auto] items-start md:items-center gap-2 md:gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xs text-white/60 whitespace-nowrap">
                  {formatTs(log.created_at)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${ACTION_COLORS[log.action] ?? "bg-white/[0.07] text-white/50"}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="truncate text-sm text-white/60">{log.admin_email}</span>
                <span className="font-mono text-[10px] text-white/60 whitespace-nowrap">
                  {log.target_type ? `${log.target_type} #${log.target_id ?? "–"}` : "–"}
                </span>
                <span className="font-mono text-[10px] text-white/55 max-w-[180px] truncate">
                  {log.details ? JSON.stringify(log.details) : "–"}
                </span>
                <span className="font-mono text-[10px] text-white/50 whitespace-nowrap">
                  {log.ip_address ?? "–"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="h-[36px] w-[36px] flex items-center justify-center rounded-lg border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/60">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="h-[36px] w-[36px] flex items-center justify-center rounded-lg border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type LogTab = "activity" | "audit";

export default function AdminLogsPage() {
  const [tab, setTab] = useState<LogTab>("activity");

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <ScrollText className="h-5 w-5 text-purple-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Logs</h1>
          <p className="text-xs text-white/70 mt-0.5">Platform activity and admin audit trail</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-1 w-fit">
        {(["activity", "audit"] as LogTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[36px] rounded-lg px-4 text-sm font-medium transition-colors ${
              tab === t ? "bg-white/[0.07] text-white" : "text-white/70 hover:text-white/90"
            }`}
          >
            {t === "activity" ? "Activity" : "Audit Log"}
          </button>
        ))}
      </div>

      {tab === "activity" ? <ActivityTab /> : <AuditTab />}
    </div>
  );
}
