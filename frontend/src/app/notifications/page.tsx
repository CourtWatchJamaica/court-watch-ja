"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { Notification } from "@/lib/types";
import {
  Bell, FileText, Calendar, CheckCheck, Megaphone, PartyPopper,
  ExternalLink, Info, AlertTriangle, AlertOctagon, ChevronDown,
  ChevronUp, X, ArrowUpDown,
} from "lucide-react";

// ── Type metadata ──────────────────────────────────────────────────────────────

type NotifMeta = {
  label: string;
  bg: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TYPE_META: Record<string, NotifMeta> = {
  new_judgment:             { label: "New Judgment",     bg: "bg-[#009B3A]/15", text: "text-[#009B3A]",                        icon: FileText      },
  sitting_changed:          { label: "Sitting Updated",  bg: "bg-[#FED100]/15", text: "text-amber-600 dark:text-[#FED100]",     icon: Calendar      },
  case_listed:              { label: "Case Listed",      bg: "bg-blue-500/15",  text: "text-blue-600 dark:text-blue-400",        icon: Calendar      },
  case_available:           { label: "Case Available",   bg: "bg-[#009B3A]/15", text: "text-[#009B3A]",                        icon: FileText      },
  sitting_reminder_1d:      { label: "Hearing Tomorrow", bg: "bg-amber-400/15", text: "text-amber-600 dark:text-amber-400",      icon: Calendar      },
  sitting_reminder_morning: { label: "Hearing Today",    bg: "bg-red-500/15",   text: "text-red-600 dark:text-red-400",          icon: Calendar      },
  announcement:             { label: "Announcement",     bg: "bg-[#FED100]/15", text: "text-amber-600 dark:text-[#FED100]",     icon: Megaphone     },
  welcome:                  { label: "Welcome",          bg: "bg-[#009B3A]/15", text: "text-[#009B3A]",                        icon: PartyPopper   },
  service_alert:            { label: "Service Alert",    bg: "bg-amber-400/15", text: "text-amber-600 dark:text-amber-400",      icon: AlertTriangle },
};

function typeToLabel(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SEVERITY_META: Record<string, Omit<NotifMeta, "label">> = {
  info:     { bg: "bg-blue-500/15",  text: "text-blue-600 dark:text-blue-400",   icon: Info          },
  warning:  { bg: "bg-amber-400/15", text: "text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  critical: { bg: "bg-red-500/15",   text: "text-red-600 dark:text-red-400",     icon: AlertOctagon  },
};

function getNotifMeta(notif: Notification): NotifMeta {
  const m = TYPE_META[notif.type];
  if (m) return m;
  if (notif.severity && notif.severity !== "info" && SEVERITY_META[notif.severity]) {
    const s = SEVERITY_META[notif.severity];
    return { label: notif.severity.charAt(0).toUpperCase() + notif.severity.slice(1), ...s };
  }
  return { label: typeToLabel(notif.type), bg: "bg-muted", text: "text-muted-foreground", icon: Bell };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-JM", { month: "short", day: "numeric" });
}

function fallbackTitle(n: Notification): string {
  switch (n.type) {
    case "new_judgment":             return `New judgment filed — Case #${n.case_id}`;
    case "case_available":           return `Tracked case now available — Case #${n.case_id}`;
    case "case_listed":              return `Case listed for a sitting — #${n.case_id}`;
    case "sitting_changed":          return `Sitting schedule changed — Case #${n.case_id}`;
    case "sitting_reminder_1d":      return "Upcoming hearing tomorrow";
    case "sitting_reminder_morning": return "Hearing scheduled for today";
    default:                         return typeToLabel(n.type);
  }
}

// ── Timeline item ──────────────────────────────────────────────────────────────

function TimelineItem({
  notif,
  isLast,
  onRead,
  onArchive,
}: {
  notif: Notification;
  isLast: boolean;
  onRead: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const meta = getNotifMeta(notif);
  const Icon = meta.icon;
  const isUnread = notif.read_at === null;
  const router = useRouter();

  const handleClick = () => {
    if (isUnread) onRead(notif.id);
    if (!notif.case_id) return;
    if (notif.type === "sitting_changed" || notif.type === "case_listed" ||
        notif.type === "sitting_reminder_1d" || notif.type === "sitting_reminder_morning") {
      router.push(`/cases/sittings/${notif.case_id}`);
    } else {
      router.push(`/cases/${notif.case_id}`);
    }
  };

  return (
    <div className="relative flex gap-3 px-4 py-3 group">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[2.125rem] top-[2.75rem] bottom-0 w-px bg-border" />
      )}

      {/* Unread dot */}
      <div className="mt-3 shrink-0 flex items-start justify-center w-3">
        {isUnread
          ? <span className="h-2 w-2 rounded-full bg-[#009B3A] ring-2 ring-[#009B3A]/20" />
          : <span className="h-2 w-2 rounded-full border border-border bg-background" />
        }
      </div>

      {/* Icon */}
      <div className={`mt-1.5 shrink-0 rounded-lg p-1.5 h-fit ${meta.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
      </div>

      {/* Content */}
      <button
        onClick={handleClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{formatRelative(notif.sent_at)}</span>
        </div>
        <p className={`text-sm leading-snug whitespace-normal ${isUnread ? "font-medium text-foreground" : "text-foreground/65"}`}>
          {notif.title ?? fallbackTitle(notif)}
        </p>
        {notif.message && (
          <p className={`mt-0.5 text-xs leading-relaxed whitespace-normal ${isUnread ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
            {notif.message}
          </p>
        )}
        {notif.link && (
          <a
            href={notif.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#009B3A] hover:underline"
          >
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </button>

      {/* Archive button */}
      <button
        onClick={() => onArchive(notif.id)}
        className="mt-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Case group card ────────────────────────────────────────────────────────────

function CaseGroupCard({
  caseNumber,
  notifications,
  onRead,
  onArchive,
}: {
  caseNumber: string;
  notifications: Notification[];
  onRead: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const unread = notifications.filter((n) => n.read_at === null).length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-foreground tracking-tight truncate">
            {caseNumber}
          </span>
          {unread > 0 && (
            <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#009B3A]/15 px-1.5 py-px text-[10px] font-bold text-[#009B3A]">
              {unread} new
            </span>
          )}
        </div>
        <a
          href={`/cases?case_number=${encodeURIComponent(caseNumber)}`}
          className="shrink-0 text-[11px] font-semibold text-[#009B3A] hover:underline"
        >
          View →
        </a>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Timeline */}
      {!collapsed && (
        <div className="divide-y divide-border/40">
          {notifications.map((n, i) => (
            <TimelineItem
              key={n.id}
              notif={n}
              isLast={i === notifications.length - 1}
              onRead={onRead}
              onArchive={onArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── System notification row ────────────────────────────────────────────────────

function SystemRow({
  notif,
  onRead,
  onArchive,
}: {
  notif: Notification;
  onRead: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const meta = getNotifMeta(notif);
  const Icon = meta.icon;
  const isUnread = notif.read_at === null;

  const handleClick = () => {
    if (isUnread) onRead(notif.id);
    if (notif.link) window.open(notif.link, "_blank");
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 group">
      <div className="mt-0.5 shrink-0 flex items-start justify-center w-3">
        {isUnread
          ? <span className="h-2 w-2 rounded-full bg-[#009B3A] ring-2 ring-[#009B3A]/20" />
          : <span className="h-2 w-2 rounded-full border border-border bg-background" />
        }
      </div>
      <div className={`shrink-0 rounded-lg p-1.5 h-fit ${meta.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
      </div>
      <button onClick={handleClick} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{formatRelative(notif.sent_at)}</span>
        </div>
        <p className={`text-sm leading-snug whitespace-normal ${isUnread ? "font-medium text-foreground" : "text-foreground/65"}`}>
          {notif.title ?? fallbackTitle(notif)}
        </p>
        {notif.message && (
          <p className={`mt-0.5 text-xs leading-relaxed whitespace-normal ${isUnread ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
            {notif.message}
          </p>
        )}
      </button>
      <button
        onClick={() => onArchive(notif.id)}
        className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-4 w-12 rounded-full bg-muted ml-1" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0">
          <div className="mt-3 h-2 w-2 rounded-full bg-muted shrink-0 ml-0.5" />
          <div className="h-7 w-7 rounded-lg bg-muted shrink-0 mt-1.5" />
          <div className="flex-1 space-y-1.5">
            <div className="flex gap-2"><div className="h-3.5 w-20 rounded-full bg-muted" /><div className="h-3.5 w-10 rounded bg-muted/60" /></div>
            <div className="h-3.5 w-3/4 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sort control ───────────────────────────────────────────────────────────────

type SortMode = "recent" | "unread" | "alpha";

const SORT_LABELS: Record<SortMode, string> = {
  recent: "Most Recent",
  unread: "Most Unread",
  alpha:  "Case Number",
};

function SortButton({ sort, onChange }: { sort: SortMode; onChange: (s: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const modes: SortMode[] = ["recent", "unread", "alpha"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {SORT_LABELS[sort]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => { onChange(m); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-muted ${
                  sort === m ? "text-[#009B3A]" : "text-foreground/70"
                }`}
              >
                {SORT_LABELS[m]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const SYSTEM_TYPES = new Set(["welcome", "announcement", "service_alert"]);

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications: data } = await apiClient.getNotifications();
      setNotifications(data);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleReadOne = useCallback(async (id: number) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
      );
    } catch { /* swallow */ }
  }, []);

  const handleArchive = useCallback(async (id: number) => {
    try {
      await apiClient.archiveNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* swallow */ }
  }, []);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await apiClient.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    } catch { /* swallow */ } finally {
      setMarking(false);
    }
  };

  // ── Group notifications ──────────────────────────────────────────────────────

  const { caseGroups, systemNotifs } = useMemo(() => {
    const groupMap = new Map<string, Notification[]>();
    const sys: Notification[] = [];

    for (const n of notifications) {
      if (n.case_number && !SYSTEM_TYPES.has(n.type)) {
        const bucket = groupMap.get(n.case_number) ?? [];
        bucket.push(n);
        groupMap.set(n.case_number, bucket);
      } else {
        sys.push(n);
      }
    }

    let entries = [...groupMap.entries()];

    if (sort === "recent") {
      entries.sort(([, a], [, b]) =>
        new Date(b[0].sent_at).getTime() - new Date(a[0].sent_at).getTime()
      );
    } else if (sort === "unread") {
      entries.sort(([, a], [, b]) => {
        const aU = a.filter((n) => !n.read_at).length;
        const bU = b.filter((n) => !n.read_at).length;
        return bU - aU || new Date(b[0].sent_at).getTime() - new Date(a[0].sent_at).getTime();
      });
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }

    return { caseGroups: entries, systemNotifs: sys };
  }, [notifications, sort]);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;
  const isEmpty = !loading && notifications.length === 0;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-16">

          {/* Page header */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#009B3A]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                  Alerts
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2.5 inline-flex items-center justify-center rounded-full bg-[#009B3A]/20 px-2 py-0.5 text-sm font-semibold text-[#009B3A]">
                    {unreadCount}
                  </span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <SortButton sort={sort} onChange={setSort} />
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={marking}
                  className="flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-muted/30">
                <Bell className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60 max-w-[200px]">
                Updates on your tracked cases will appear here.
              </p>
              <button
                onClick={() => router.push("/cases")}
                className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Browse Cases
              </button>
            </div>
          )}

          {/* Case-grouped timeline */}
          {!loading && caseGroups.length > 0 && (
            <div className="space-y-3">
              {caseGroups.map(([caseNumber, notifs]) => (
                <CaseGroupCard
                  key={caseNumber}
                  caseNumber={caseNumber}
                  notifications={notifs}
                  onRead={handleReadOne}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}

          {/* System notifications */}
          {!loading && systemNotifs.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                  System
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border/50">
                {systemNotifs.map((n) => (
                  <SystemRow
                    key={n.id}
                    notif={n}
                    onRead={handleReadOne}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && notifications.length > 0 && (
            <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
              Showing up to 100 recent notifications · Dismissed notifications are hidden
            </p>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
