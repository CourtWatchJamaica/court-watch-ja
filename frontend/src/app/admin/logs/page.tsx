"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ActivityLogRow } from "@/lib/types";
import { ScrollText, RefreshCw, Bell, FileText, Calendar } from "lucide-react";

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

export default function AdminLogsPage() {
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { activity: rows } = await apiClient.adminGetActivityLog();
      setActivity(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-JM", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-5 w-5 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Activity Log</h1>
            <p className="text-xs text-white/40 mt-0.5">Recent notifications sent across the platform</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
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

      {/* Summary bar */}
      {!loading && activity.length > 0 && (
        <div className="mb-5 flex gap-3">
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
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Type</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">User</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Case</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Time</span>
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
            <p className="text-sm text-white/30">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {activity.map((row) => {
              const Icon = TYPE_ICONS[row.notification_type] ?? Bell;
              const colorClass = TYPE_COLORS[row.notification_type] ?? "bg-white/[0.07] text-white/50";
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${colorClass}`}>
                    <Icon className="h-3 w-3" />
                    {TYPE_LABELS[row.notification_type] ?? row.notification_type}
                  </span>
                  <span className="truncate text-sm text-white/60">{row.email}</span>
                  <span className="font-mono text-[10px] text-white/30">#{row.case_id}</span>
                  <span className="text-xs text-white/30 whitespace-nowrap">{formatTime(row.sent_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && activity.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-white/20">
          Showing the 100 most recent events
        </p>
      )}
    </div>
  );
}
