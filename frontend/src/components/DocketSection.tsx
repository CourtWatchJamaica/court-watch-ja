"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, X, ArrowRight, Scale, Building2, Plus, Loader2, Calendar, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaseLookupResult, Judgment, UserCase, CourtSitting } from "@/lib/types";
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
  if (!nextSitting?.event_date) return "bg-foreground/20";
  const date = new Date(`${nextSitting.event_date}T00:00:00`);
  const diffDays = (date.getTime() - Date.now()) / 86_400_000;
  if (diffDays <= 1) return "bg-red-500";
  if (diffDays <= 7) return "bg-amber-400";
  return "bg-primary";
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
  if (!date) return "bg-foreground/[0.07] text-foreground/35";
  const diffDays = Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000,
  );
  if (diffDays <= 1) return "bg-red-500/15 text-red-400";
  if (diffDays <= 7) return "bg-amber-400/15 text-amber-400";
  return "bg-primary/[0.12] text-primary";
}

/* ── Notification Settings Modal ── */

interface NotifSettings {
  notify_immediately: boolean;
  notify_day_before: boolean;
  notify_morning_of: boolean;
}

const NOTIF_ITEMS: { key: keyof NotifSettings; label: string; sub: string }[] = [
  { key: "notify_immediately", label: "When listed or updated",  sub: "Any change to this case" },
  { key: "notify_day_before",  label: "Day before the hearing",  sub: "Evening reminder" },
  { key: "notify_morning_of",  label: "Morning of the hearing",  sub: "Same-day alert at 7 AM" },
];

function NotifModal({
  rowId,
  initial,
  caseLabel,
  onClose,
}: {
  rowId: number;
  initial: NotifSettings;
  caseLabel?: string;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<NotifSettings>(initial);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus trap + initial focus
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const sel = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const getFocusables = () => Array.from(modal.querySelectorAll<HTMLElement>(sel));
    getFocusables()[0]?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = getFocusables();
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, []);

  const toggle = (key: keyof NotifSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    apiClient.updateCaseSettings(rowId, next).finally(() => setSaving(false));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Notification settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        ref={modalRef}
        className="relative z-10 w-[90vw] max-w-[380px] rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl ring-1 ring-inset ring-foreground/[0.04]"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              Notifications
            </p>
            {caseLabel && (
              <p className="mt-0.5 max-w-[260px] truncate font-mono text-[11px] text-foreground/35">
                {caseLabel}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-1.5 text-foreground/30 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/70"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toggle rows */}
        <div className="space-y-0.5 px-3 py-3">
          {NOTIF_ITEMS.map(({ key, label, sub }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
            >
              {/* Pill toggle */}
              <div
                aria-checked={settings[key]}
                role="switch"
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                  settings[key] ? "bg-accent" : "bg-foreground/[0.12]"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings[key] ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-medium leading-snug transition-colors ${
                  settings[key] ? "text-foreground/90" : "text-foreground/40"
                }`}>
                  {label}
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/25">{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="flex h-4 items-center gap-1.5">
            {saving && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
                <span className="text-[10px] text-foreground/30">Saving…</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-foreground/[0.06] px-3 py-1.5 text-[11px] font-medium text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground/80"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
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

  const statusColor = isPending ? "bg-accent/40" : getStatusColor(item.nextSitting);
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
        className="group relative flex rounded-xl border border-border bg-card transition-all duration-200 hover:border-foreground/[0.12] hover:bg-card/80 overflow-hidden cursor-pointer"
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
            <div className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5">
              <Scale className="h-2.5 w-2.5 text-primary" />
              <span className="text-[9px] font-semibold text-primary truncate max-w-[80px]">
                {court}
              </span>
            </div>

            {/* Notification settings bell */}
            <button
              onClick={(e) => { e.stopPropagation(); setNotifOpen((p) => !p); }}
              className="flex items-center gap-0.5 rounded px-0.5 transition-colors hover:bg-foreground/[0.06]"
              aria-label="Notification settings"
            >
              <Bell
                className={`h-3 w-3 ${activeAlerts > 0 ? "text-accent" : "text-foreground/20"}`}
              />
              {activeAlerts > 0 && (
                <span className="text-[9px] font-bold text-accent">
                  {activeAlerts}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotifModal
                rowId={userCase.id}
                initial={defaultSettings}
                caseLabel={citation ?? title}
                onClose={() => setNotifOpen(false)}
              />
            )}

            {isSitting && (
              <span className="rounded-full bg-accent/10 border border-accent/20 px-1.5 py-0.5 text-[8px] font-semibold text-accent">
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
              className="shrink-0 rounded-md p-0.5 text-foreground/20 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors md:opacity-0 md:group-hover:opacity-100"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Title */}
          <p className="text-[13px] font-semibold text-foreground/85 leading-snug line-clamp-1 group-hover:text-foreground transition-colors">
            {title}
          </p>

          {/* Bottom row */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {citation && (
              <span className="font-mono text-[10px] text-foreground/30">{citation}</span>
            )}
            {isPending && userCase.case_number && (
              <span className="font-mono text-[10px] text-foreground/30">
                {userCase.case_number}
              </span>
            )}
            {hearingDateStr && (
              <>
                <span className="text-foreground/[0.15]">·</span>
                <div className="flex items-center gap-1 text-[10px] text-foreground/35">
                  <Building2 className="h-2.5 w-2.5 text-foreground/20" />
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
              <span className="text-[10px] text-foreground/25">No upcoming hearing</span>
            )}
            {isPending && (
              <span className="text-[10px] text-foreground/25">Watching for court listing…</span>
            )}
            {!isPending && (
              <ArrowRight className="h-3 w-3 text-foreground/[0.15] group-hover:text-foreground/40 ml-auto shrink-0 transition-colors" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Add by Case Number input ── */

interface TrackedRow {
  rowId: number;
  caseNumber: string;
  settings: NotifSettings;
}

export function AddByNumberForm({ onRefresh }: { onRefresh: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracked, setTracked] = useState<TrackedRow | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  // ── Case-lookup preview ──
  const [preview, setPreview] = useState<CaseLookupResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setPreview(null);
      setShowPreview(false);
      return;
    }
    setShowPreview(true);
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = await apiClient.caseLookup(trimmed);
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 300);
    return () => { cancelled = true; };
  }, [value]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setShowPreview(false);
    setNotifOpen(false);
    try {
      await apiClient.addUserCaseByNumber(trimmed, "judgment");
      const { cases } = await apiClient.getUserCases();
      const newCase = cases.find((c) => c.case_number === trimmed);
      setTracked({
        rowId: newCase?.id ?? 0,
        caseNumber: trimmed,
        settings: {
          notify_immediately: newCase?.notify_immediately ?? true,
          notify_day_before: newCase?.notify_day_before ?? true,
          notify_morning_of: newCase?.notify_morning_of ?? true,
        },
      });
      setValue("");
      setPreview(null);
      onRefresh();
    } catch {
      setError("Could not add that case number. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectPreviewCase = (caseNumber: string) => {
    setValue(caseNumber);
    setShowPreview(false);
  };

  const activeCount = tracked
    ? Object.values(tracked.settings).filter(Boolean).length
    : 0;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-foreground/30">
        Track by Case Number
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onBlur={() => setTimeout(() => setShowPreview(false), 150)}
          onFocus={() => { if (value.trim().length >= 3 && preview) setShowPreview(true); }}
          placeholder="e.g. HCV/01234/2025"
          className="flex-1 min-w-0 rounded-lg border border-border bg-foreground/[0.04] px-3 py-2 text-[12px] text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors min-h-[44px]"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 text-[11px] font-semibold text-accent hover:bg-accent/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Track
        </button>
      </form>

      {/* Live preview dropdown */}
      {showPreview && value.trim().length >= 3 && (
        <div
          className="mt-1.5 rounded-xl border border-border bg-card overflow-hidden shadow-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {previewLoading ? (
            <div className="flex items-center gap-2 px-3 py-3">
              <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
              <span className="text-[11px] text-foreground/30">Searching…</span>
            </div>
          ) : preview?.found ? (
            <div className="divide-y divide-border">
              {preview.judgments.map((j) => (
                <button
                  key={`j-${j.id}`}
                  type="button"
                  onClick={() => selectPreviewCase(j.case_number)}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/[0.04] transition-colors"
                >
                  <FileText className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground/80">
                      {j.title || j.case_number}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-foreground/35">{j.case_number}</span>
                      {j.court && (
                        <span className="text-[10px] text-foreground/25">{j.court}</span>
                      )}
                      {j.date && (
                        <span className="flex items-center gap-1 text-[10px] text-foreground/25">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(j.date).toLocaleDateString("en-JM", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/[0.12] px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    Judgment
                  </span>
                </button>
              ))}
              {preview.sittings.map((s) => (
                <button
                  key={`s-${s.id}`}
                  type="button"
                  onClick={() => selectPreviewCase(s.case_number ?? value.trim())}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/[0.04] transition-colors"
                >
                  <Calendar className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground/80">
                      {s.title || s.case_number || "Untitled Sitting"}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      {s.case_number && (
                        <span className="font-mono text-[10px] text-foreground/35">{s.case_number}</span>
                      )}
                      {s.court && (
                        <span className="text-[10px] text-foreground/25">{s.court}</span>
                      )}
                      {s.event_date && (
                        <span className="flex items-center gap-1 text-[10px] text-foreground/25">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(`${s.event_date}T00:00:00`).toLocaleDateString("en-JM", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                    Sitting
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3">
              <p className="text-[11px] text-foreground/35">
                No existing cases match — you can still track this number.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[10px] text-red-400">{error}</p>
      )}

      {tracked && !error && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-2.5 py-2">
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="flex-1 truncate font-mono text-[11px] text-foreground/70">
            {tracked.caseNumber}
          </span>
          <span className="shrink-0 text-[10px] font-medium text-primary">
            Tracking
          </span>
          {tracked.rowId > 0 && (
            <button
              type="button"
              onClick={() => setNotifOpen((p) => !p)}
              className="flex shrink-0 items-center gap-0.5 rounded px-0.5 transition-colors hover:bg-foreground/[0.06]"
              aria-label="Notification settings"
            >
              <Bell
                className={`h-3 w-3 transition-colors ${
                  activeCount > 0 ? "text-accent" : "text-foreground/20"
                }`}
              />
              {activeCount > 0 && (
                <span className="text-[9px] font-bold text-accent">{activeCount}</span>
              )}
            </button>
          )}
          {notifOpen && tracked.rowId > 0 && (
            <NotifModal
              rowId={tracked.rowId}
              initial={tracked.settings}
              caseLabel={tracked.caseNumber}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Empty State ── */

function DocketEmpty({ onRefresh }: { onRefresh: () => void }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-10 text-center px-4">
      <svg
        viewBox="0 0 64 64"
        className="mb-4 h-12 w-12 text-foreground/10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="8" y="28" width="48" height="28" rx="1" strokeOpacity="0.6" />
        <path d="M4 28 L32 8 L60 28" strokeOpacity="0.6" />
        <rect x="20" y="40" width="8" height="16" rx="1" />
        <rect x="36" y="40" width="8" height="16" rx="1" />
        <line x1="8" y1="28" x2="56" y2="28" />
        <circle cx="32" cy="20" r="3" fill="var(--accent)" stroke="var(--accent)" strokeOpacity="0.8" />
      </svg>
      <p className="text-sm font-medium text-foreground/40 mb-1">Your Docket is empty</p>
      <p className="text-[12px] text-foreground/25 mb-4 max-w-[220px] leading-relaxed">
        Add cases you&apos;re following to your Docket. Upcoming hearings and alerts will appear here.
      </p>
      <Button
        size="sm"
        onClick={() => router.push("/cases")}
        className="h-11 sm:h-8 bg-primary px-4 text-xs text-white hover:bg-primary/85"
      >
        Browse Cases
      </Button>
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
          className="flex rounded-xl border border-border bg-card overflow-hidden animate-pulse"
        >
          <div className="w-1 bg-foreground/[0.06]" />
          <div className="flex-1 px-4 py-3 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-20 rounded-full bg-foreground/[0.06]" />
            </div>
            <div className="h-3.5 w-3/4 rounded bg-foreground/[0.06]" />
            <div className="h-2.5 w-1/2 rounded bg-foreground/[0.04]" />
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
          <div className="h-px w-3 bg-accent/60" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            Your Docket
          </span>
          {!loading && trackedCases.length > 0 && (
            <Badge className="h-4 px-1.5 text-[9px] bg-accent/10 text-accent border border-accent/20 font-semibold rounded-full">
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
        </>
      ) : (
        <DocketEmpty onRefresh={onRefresh} />
      )}
    </section>
  );
}
