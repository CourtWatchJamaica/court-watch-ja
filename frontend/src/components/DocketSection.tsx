"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, ArrowRight, Scale, Building2, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Judgment, UserCase, CourtSitting } from "@/lib/types";
import { apiClient } from "@/lib/api";

/* ── Types ── */

interface DocketItem {
  userCase: UserCase;
  judgment: Judgment | null;
  sitting: CourtSitting | null;
  nextSitting: CourtSitting | null;
}

interface DocketSectionProps {
  trackedCases: UserCase[];
  judgments: Judgment[];
  sittings: CourtSitting[];
  loading: boolean;
  onUntrack: (rowId: number) => void;
  onRefresh: () => void;
}

/* ── Helpers ── */

const TODAY = new Date().toISOString().split("T")[0];

function getStatusColor(nextSitting: CourtSitting | null): string {
  if (!nextSitting?.event_date) return "bg-white/20";
  const date = new Date(`${nextSitting.event_date}T00:00:00`);
  const diffDays = (date.getTime() - Date.now()) / 86_400_000;
  if (diffDays <= 1) return "bg-red-500";
  if (diffDays <= 7) return "bg-amber-400";
  return "bg-[#009B3A]";
}

function getCountdown(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  const diffDays = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diffDays < 0) return "Past";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `in ${diffDays}d`;
  if (diffDays < 30) return `in ${Math.floor(diffDays / 7)}w`;
  return `in ${Math.floor(diffDays / 30)}mo`;
}

function getCountdownColor(date: string | null): string {
  if (!date) return "bg-white/[0.07] text-white/35";
  const diffDays = Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000,
  );
  if (diffDays <= 1) return "bg-red-500/15 text-red-400";
  if (diffDays <= 7) return "bg-amber-400/15 text-amber-400";
  return "bg-[#009B3A]/12 text-[#009B3A]";
}

/* ── Notification Settings Popover ── */

interface NotifSettings {
  notify_immediately: boolean;
  notify_day_before: boolean;
  notify_morning_of: boolean;
}

function NotifPopover({
  rowId,
  initial,
}: {
  rowId: number;
  initial: NotifSettings;
}) {
  const [settings, setSettings] = useState<NotifSettings>(initial);
  const [saving, setSaving] = useState(false);

  const toggle = (key: keyof NotifSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    apiClient
      .updateCaseSettings(rowId, next)
      .finally(() => setSaving(false));
  };

  return (
    <div
      className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-white/[0.1] bg-[#0d0d1a] p-3 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#FED100]">
          Notify me
        </span>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-white/30" />}
      </div>
      {(
        [
          { key: "notify_immediately" as const, label: "When listed / updated" },
          { key: "notify_day_before" as const, label: "Day before hearing" },
          { key: "notify_morning_of" as const, label: "Morning of hearing" },
        ] as const
      ).map(({ key, label }) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.04]"
        >
          <div
            className={`h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors ${
              settings[key]
                ? "border-[#FED100] bg-[#FED100]"
                : "border-white/20 bg-transparent"
            }`}
            onClick={() => toggle(key)}
          >
            {settings[key] && (
              <svg viewBox="0 0 10 8" className="h-full w-full p-0.5">
                <polyline
                  points="1,4 3.5,6.5 9,1"
                  fill="none"
                  stroke="#0d0d1a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <span className="text-[11px] text-white/60">{label}</span>
        </label>
      ))}
    </div>
  );
}

/* ── DocketCard ── */

function DocketCard({
  item,
  onUntrack,
}: {
  item: DocketItem;
  onUntrack: (rowId: number) => void;
}) {
  const router = useRouter();
  const { userCase } = item;
  const isPending = userCase.case_id == null;
  const isSitting = userCase.case_type === "sitting";
  const navUrl =
    !isPending && isSitting
      ? `/cases/sittings/${userCase.case_id}`
      : !isPending
        ? `/cases/${userCase.case_id}`
        : null;

  const statusColor = isPending ? "bg-[#FED100]/40" : getStatusColor(item.nextSitting);
  const countdown = getCountdown(item.nextSitting?.event_date ?? null);
  const countdownColor = getCountdownColor(item.nextSitting?.event_date ?? null);

  const defaultSettings: NotifSettings = {
    notify_immediately: userCase.notify_immediately ?? true,
    notify_day_before: userCase.notify_day_before ?? true,
    notify_morning_of: userCase.notify_morning_of ?? true,
  };
  const activeAlerts = Object.values(defaultSettings).filter(Boolean).length;

  const title = isPending
    ? (userCase.case_number ?? "Pending case")
    : isSitting
      ? (item.sitting?.title || item.sitting?.case_number || `Sitting #${userCase.case_id}`)
      : (item.judgment?.title || `Case #${userCase.case_id}`);
  const citation = isPending
    ? null
    : isSitting
      ? (item.sitting?.case_number ?? null)
      : (item.judgment?.case_number ?? null);
  const court = isPending
    ? "Pending"
    : isSitting
      ? (item.sitting?.court_division ?? "Court")
      : (item.judgment?.court ?? "Supreme Court");
  const hearingDateStr = item.nextSitting?.event_date ?? null;

  /* Swipe-to-reveal on mobile */
  const startXRef = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    if (delta < 0) setOffsetX(Math.max(delta, -80));
    else if (revealed && delta > 0) setOffsetX(Math.min(0, -80 + delta));
  };
  const handleTouchEnd = () => {
    startXRef.current = null;
    if (offsetX < -40) { setOffsetX(-80); setRevealed(true); }
    else { setOffsetX(0); setRevealed(false); }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-reveal remove button */}
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center rounded-r-xl bg-red-500/90">
        <button
          onClick={() => onUntrack(userCase.id)}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Remove from Docket"
        >
          <X className="h-4 w-4" />
          <span className="text-[9px] font-semibold">Remove</span>
        </button>
      </div>

      {/* Card */}
      <div
        className="group relative flex rounded-xl border border-white/[0.07] bg-[#0d0d1a] transition-all duration-200 hover:border-white/[0.12] hover:bg-[#0d0d1a]/80 overflow-hidden cursor-pointer"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: startXRef.current === null ? "transform 0.25s ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (offsetX !== 0) { setOffsetX(0); setRevealed(false); return; }
          if (navUrl) router.push(navUrl);
        }}
      >
        {/* Left status bar */}
        <div className={`w-1 shrink-0 self-stretch rounded-l-xl ${statusColor}`} />

        {/* Content */}
        <div className="flex-1 px-4 py-3 min-w-0">
          {/* Top row */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1 rounded-full bg-[#009B3A]/10 border border-[#009B3A]/20 px-2 py-0.5">
              <Scale className="h-2.5 w-2.5 text-[#009B3A]" />
              <span className="text-[9px] font-semibold text-[#009B3A] truncate max-w-[80px]">
                {court}
              </span>
            </div>

            {/* Notification settings bell */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setNotifOpen((p) => !p)}
                className="flex items-center gap-0.5 rounded px-0.5 transition-colors hover:bg-white/[0.06]"
                aria-label="Notification settings"
              >
                <Bell
                  className={`h-3 w-3 ${activeAlerts > 0 ? "text-[#FED100]" : "text-white/20"}`}
                />
                {activeAlerts > 0 && (
                  <span className="text-[9px] font-bold text-[#FED100]">
                    {activeAlerts}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotifPopover
                  rowId={userCase.id}
                  initial={defaultSettings}
                />
              )}
            </div>

            {isSitting && (
              <span className="rounded-full bg-[#FED100]/10 border border-[#FED100]/20 px-1.5 py-0.5 text-[8px] font-semibold text-[#FED100]">
                Sitting
              </span>
            )}
            {isPending && (
              <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 text-[8px] font-semibold text-amber-400">
                Pending
              </span>
            )}
            <div className="flex-1" />
            {/* × button */}
            <button
              onClick={(e) => { e.stopPropagation(); onUntrack(userCase.id); }}
              className="shrink-0 rounded-md p-0.5 text-white/20 hover:text-white/70 hover:bg-white/[0.06] transition-colors md:opacity-0 md:group-hover:opacity-100"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Title */}
          <p className="text-[13px] font-semibold text-white/85 leading-snug line-clamp-1 group-hover:text-white transition-colors">
            {title}
          </p>

          {/* Bottom row */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {citation && (
              <span className="font-mono text-[10px] text-white/30">{citation}</span>
            )}
            {isPending && userCase.case_number && (
              <span className="font-mono text-[10px] text-white/30">
                {userCase.case_number}
              </span>
            )}
            {hearingDateStr && (
              <>
                <span className="text-white/15">·</span>
                <div className="flex items-center gap-1 text-[10px] text-white/35">
                  <Building2 className="h-2.5 w-2.5 text-white/20" />
                  {new Date(`${hearingDateStr}T00:00:00`).toLocaleDateString("en-JM", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                {countdown && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${countdownColor}`}>
                    {countdown}
                  </span>
                )}
              </>
            )}
            {!hearingDateStr && !isPending && (
              <span className="text-[10px] text-white/25">No upcoming hearing</span>
            )}
            {isPending && (
              <span className="text-[10px] text-white/25">Watching for court listing…</span>
            )}
            {!isPending && (
              <ArrowRight className="h-3 w-3 text-white/15 group-hover:text-white/40 ml-auto shrink-0 transition-colors" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Add by Case Number input ── */

function AddByNumberForm({ onRefresh }: { onRefresh: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setFeedback(null);
    try {
      await apiClient.addUserCaseByNumber(trimmed, "judgment");
      setValue("");
      setFeedback("Tracking — we'll alert you when it's listed.");
      onRefresh();
    } catch {
      setFeedback("Could not add that case number. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#0d0d1a] px-3 py-2.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
        Track by Case Number
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. HCV/01234/2025"
          className="flex-1 min-w-0 rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-[#FED100]/40 focus:ring-1 focus:ring-[#FED100]/20 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[#FED100]/10 border border-[#FED100]/20 px-3 py-2 text-[11px] font-semibold text-[#FED100] hover:bg-[#FED100]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Track
        </button>
      </form>
      {feedback && (
        <p className="mt-1.5 text-[10px] text-white/40">{feedback}</p>
      )}
    </div>
  );
}

/* ── Empty State ── */

function DocketEmpty({ onRefresh }: { onRefresh: () => void }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-10 text-center px-4">
      <svg
        viewBox="0 0 64 64"
        className="mb-4 h-12 w-12 text-white/10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="8" y="28" width="48" height="28" rx="1" strokeOpacity="0.6" />
        <path d="M4 28 L32 8 L60 28" strokeOpacity="0.6" />
        <rect x="20" y="40" width="8" height="16" rx="1" />
        <rect x="36" y="40" width="8" height="16" rx="1" />
        <line x1="8" y1="28" x2="56" y2="28" />
        <circle cx="32" cy="20" r="3" fill="#FED100" stroke="#FED100" strokeOpacity="0.8" />
      </svg>
      <p className="text-sm font-medium text-white/40 mb-1">Your Docket is empty</p>
      <p className="text-[12px] text-white/25 mb-4 max-w-[220px] leading-relaxed">
        Add cases you&apos;re following to your Docket. Upcoming hearings and alerts will appear here.
      </p>
      <Button
        size="sm"
        onClick={() => router.push("/cases")}
        className="h-8 bg-[#009B3A] px-4 text-xs text-white hover:bg-[#009B3A]/85"
      >
        Browse Cases
      </Button>
      <AddByNumberForm onRefresh={onRefresh} />
    </div>
  );
}

/* ── Skeleton ── */

function DocketSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex rounded-xl border border-white/[0.06] bg-[#0d0d1a] overflow-hidden animate-pulse"
        >
          <div className="w-1 bg-white/[0.06]" />
          <div className="flex-1 px-4 py-3 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-20 rounded-full bg-white/[0.06]" />
            </div>
            <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
            <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Section ── */

export default function DocketSection({
  trackedCases,
  judgments,
  sittings,
  loading,
  onUntrack,
  onRefresh,
}: DocketSectionProps) {
  const router = useRouter();

  const enriched: DocketItem[] = trackedCases.map((uc) => {
    if (uc.case_id == null) {
      return { userCase: uc, judgment: null, sitting: null, nextSitting: null };
    }
    if (uc.case_type === "sitting") {
      const sitting = sittings.find((s) => s.id === uc.case_id) ?? null;
      const nextSitting =
        sitting?.event_date && sitting.event_date >= TODAY ? sitting : null;
      return { userCase: uc, judgment: null, sitting, nextSitting };
    }
    const judgment = judgments.find((j) => j.id === uc.case_id) ?? null;
    const nextSitting = judgment
      ? (sittings
          .filter(
            (s) =>
              s.case_number === judgment.case_number &&
              s.event_date != null &&
              s.event_date >= TODAY,
          )
          .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
          .at(0) ?? null)
      : null;
    return { userCase: uc, judgment, sitting: null, nextSitting };
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-px w-3 bg-[#FED100]/60" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FED100]">
            Your Docket
          </span>
          {!loading && trackedCases.length > 0 && (
            <Badge className="h-4 px-1.5 text-[9px] bg-[#FED100]/10 text-[#FED100] border border-[#FED100]/20 font-semibold rounded-full">
              {trackedCases.length}
            </Badge>
          )}
        </div>
        <button
          onClick={() => router.push("/cases")}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Track more
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <DocketSkeleton />
      ) : enriched.length > 0 ? (
        <>
          <div className="space-y-2">
            {enriched.map((item) => (
              <DocketCard key={item.userCase.id} item={item} onUntrack={onUntrack} />
            ))}
          </div>
          <AddByNumberForm onRefresh={onRefresh} />
        </>
      ) : (
        <DocketEmpty onRefresh={onRefresh} />
      )}
    </section>
  );
}
