"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { Notification } from "@/lib/types";
import { Bell, FileText, Calendar, CheckCheck, Megaphone, PartyPopper, ExternalLink, Info, AlertTriangle, AlertOctagon } from "lucide-react";

const TYPE_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  new_judgment:             { label: "New Judgment",      color: "bg-[#009B3A]/15 text-[#009B3A]",   icon: FileText      },
  sitting_changed:          { label: "Sitting Updated",   color: "bg-[#FED100]/15 text-[#FED100]",   icon: Calendar      },
  case_listed:              { label: "Case Listed",       color: "bg-blue-500/15 text-blue-400",      icon: Calendar      },
  case_available:           { label: "Case Available",    color: "bg-[#009B3A]/15 text-[#009B3A]",   icon: FileText      },
  sitting_reminder_1d:      { label: "Hearing Tomorrow",  color: "bg-amber-400/15 text-amber-400",   icon: Calendar      },
  sitting_reminder_morning: { label: "Hearing Today",     color: "bg-red-500/15 text-red-400",        icon: Calendar      },
  announcement:             { label: "Announcement",      color: "bg-[#FED100]/15 text-[#FED100]",   icon: Megaphone     },
  welcome:                  { label: "Welcome",           color: "bg-[#009B3A]/15 text-[#009B3A]",   icon: PartyPopper   },
};

const SEVERITY_META: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  info:     { color: "bg-blue-500/15 text-blue-400",    icon: Info           },
  warning:  { color: "bg-amber-400/15 text-amber-400",  icon: AlertTriangle  },
  critical: { color: "bg-red-500/15 text-red-400",      icon: AlertOctagon   },
};

function NotifMeta(notif: { type: string; severity?: string | null }) {
  // For types that have their own identity (announcement, welcome, case-specific),
  // use the type meta. For generic types with a non-info severity, override with severity colors.
  const typeMeta = TYPE_META[notif.type];
  if (typeMeta) return typeMeta;
  if (notif.severity && notif.severity !== "info" && SEVERITY_META[notif.severity]) {
    return { label: notif.severity.charAt(0).toUpperCase() + notif.severity.slice(1), ...SEVERITY_META[notif.severity] };
  }
  return { label: notif.type, color: "bg-white/[0.07] text-white/50", icon: Bell };
}

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

function NotifRow({
  notif,
  onRead,
}: {
  notif: Notification;
  onRead: (id: number) => void;
}) {
  const router = useRouter();
  const meta = NotifMeta(notif);
  const Icon = meta.icon;
  const isUnread = notif.read_at === null;

  const handleClick = () => {
    if (isUnread) onRead(notif.id);
    if (!notif.case_id) return;
    router.push(
      notif.type === "sitting_changed" || notif.type === "case_listed"
        ? `/cases/sittings/${notif.case_id}`
        : `/cases/${notif.case_id}`,
    );
  };

  return (
    <button
      onClick={handleClick}
      className={`group w-full text-left flex items-start gap-4 px-4 py-4 transition-colors hover:bg-white/[0.02] ${
        isUnread ? "bg-white/[0.015]" : ""
      }`}
    >
      {/* Unread dot */}
      <div className="mt-1 shrink-0 w-2 flex justify-center">
        {isUnread && <span className="h-2 w-2 rounded-full bg-[#009B3A]" />}
      </div>

      {/* Icon */}
      <div className={`shrink-0 rounded-xl p-2 ${meta.color.split(" ")[0]}`}>
        <Icon className={`h-4 w-4 ${meta.color.split(" ")[1]}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-white/25">{formatRelative(notif.sent_at)}</span>
        </div>
        <p className={`text-sm font-medium leading-snug ${isUnread ? "text-white/85" : "text-white/55"}`}>
          {notif.title
            ? notif.title
            : notif.type === "new_judgment"
              ? `New judgment filed — Case #${notif.case_id}`
              : notif.type === "case_available"
                ? `Your tracked case is now available — Case #${notif.case_id}`
                : notif.type === "case_listed"
                  ? `Your case has been listed for a sitting — #${notif.case_id}`
                  : `Sitting schedule changed — Case #${notif.case_id}`}
        </p>
        {notif.message && (
          <p className={`mt-0.5 text-xs leading-relaxed line-clamp-3 ${isUnread ? "text-white/45" : "text-white/30"}`}>
            {notif.message}
          </p>
        )}
        {notif.link && (
          <a
            href={notif.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#009B3A] hover:underline"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications: data } = await apiClient.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
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
    } catch {/* swallow */}
  }, []);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await apiClient.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    } catch {/* swallow */} finally {
      setMarking(false);
    }
  };

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-16">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
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

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={marking}
                className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden divide-y divide-white/[0.04]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 px-4 py-4 animate-pulse">
                  <div className="mt-1 w-2 h-2 rounded-full bg-white/[0.06]" />
                  <div className="h-9 w-9 rounded-xl bg-white/[0.06] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-4 w-24 rounded-full bg-white/[0.06]" />
                      <div className="h-4 w-12 rounded bg-white/[0.04]" />
                    </div>
                    <div className="h-3.5 w-3/4 rounded bg-white/[0.04]" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
                  <Bell className="h-7 w-7 text-white/15" />
                </div>
                <p className="text-sm font-medium text-white/35">No notifications yet</p>
                <p className="mt-1 text-xs text-white/20 max-w-[200px]">
                  Updates on your tracked cases will appear here.
                </p>
                <button
                  onClick={() => router.push("/cases")}
                  className="mt-4 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  Browse Cases
                </button>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow key={n.id} notif={n} onRead={handleReadOne} />
              ))
            )}
          </div>

          {!loading && notifications.length > 0 && (
            <p className="mt-4 text-center text-[11px] text-white/20">
              Showing the 100 most recent notifications
            </p>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
