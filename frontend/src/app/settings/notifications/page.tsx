"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient, type UserPreferences } from "@/lib/api";
import { UserCase, Judgment } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Bell,
  BellOff,
  Scale,
  X,
  ChevronRight,
  Clock,
  Mail,
} from "lucide-react";
import {
  ScanAlertSettings,
  DEFAULT_SCAN_ALERT_PREFS,
  type ScanAlertPrefs,
} from "@/components/ScanAlertSettings";
import { cn } from "@/lib/utils";

/* ── Types ──
 * These mirror the backend's per-tracked-case preferences
 * (user_case_settings.notify_*). They are persisted through
 * PUT /api/user/cases/:row_id/settings and read back on GET /api/user/cases,
 * so they drive the real in-app + email alerts — nothing is kept in
 * localStorage any more.
 */
type AlertKey = "notify_immediately" | "notify_day_before" | "notify_morning_of";

interface CaseNotifSettings {
  notify_immediately: boolean;
  notify_day_before: boolean;
  notify_morning_of: boolean;
}

const ALERTS: { id: AlertKey; label: string; description: string }[] = [
  {
    id: "notify_immediately",
    label: "When listed or updated",
    description: "Listed on a court list, rescheduled, or judgment published",
  },
  {
    id: "notify_day_before",
    label: "Day before the hearing",
    description: "Reminder the morning before the sitting",
  },
  {
    id: "notify_morning_of",
    label: "Morning of the hearing",
    description: "Same-day reminder, around 6 AM",
  },
];

/* ── Helpers ── */

/** Backend treats a missing preference row as "all on". */
function settingsFor(uc: UserCase): CaseNotifSettings {
  return {
    notify_immediately: uc.notify_immediately ?? true,
    notify_day_before: uc.notify_day_before ?? true,
    notify_morning_of: uc.notify_morning_of ?? true,
  };
}

function anyEnabled(s: CaseNotifSettings): boolean {
  return s.notify_immediately || s.notify_day_before || s.notify_morning_of;
}

function caseLabel(uc: UserCase, judgments: Judgment[]): { title: string; court: string | null; citation: string | null } {
  const j =
    uc.case_type === "judgment" && uc.case_id != null
      ? judgments.find((x) => x.id === uc.case_id)
      : undefined;
  const citation = uc.case_number ?? j?.case_number ?? null;
  const title = j?.title || citation || `Case #${uc.case_id ?? uc.id}`;
  const court =
    j?.court ??
    (uc.case_type === "parish_court"
      ? "Parish Court"
      : uc.case_type === "sitting"
        ? "Court list"
        : null);
  return { title, court, citation: j?.title ? citation : null };
}

/* ── Toast ── */

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 rounded-full border border-foreground/15 bg-card/90 backdrop-blur-xl px-5 py-2.5 shadow-lg">
      <Bell className="h-3.5 w-3.5 text-[#009B3A]" />
      <span className="text-[12px] font-medium text-foreground">{message}</span>
    </div>
  );
}

/* ── Case Notification Panel ── */

function CasePanel({
  uc,
  judgments,
  settings,
  saving,
  onUpdate,
}: {
  uc: UserCase;
  judgments: Judgment[];
  settings: CaseNotifSettings;
  saving: boolean;
  onUpdate: (s: CaseNotifSettings) => void;
}) {
  const { title, court, citation } = caseLabel(uc, judgments);
  const enabled = anyEnabled(settings);

  const toggleAlert = (k: AlertKey) => onUpdate({ ...settings, [k]: !settings[k] });

  const setAll = (v: boolean) =>
    onUpdate({ notify_immediately: v, notify_day_before: v, notify_morning_of: v });

  return (
    <div className="flex-1 space-y-5">
      {/* Case info */}
      <div className="rounded-3xl border border-foreground/[0.07] bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 rounded-full bg-[#009B3A]/10 border border-[#009B3A]/20 px-2.5 py-1">
            <Scale className="h-3 w-3 text-[#009B3A]" />
            <span className="text-[10px] font-semibold text-[#009B3A]">{court ?? "Supreme Court"}</span>
          </div>
        </div>
        <p className="text-[14px] font-semibold text-foreground leading-snug">{title}</p>
        {citation && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{citation}</p>
        )}
      </div>

      {/* Master toggle */}
      <div className="rounded-3xl border border-foreground/[0.07] bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {enabled ? (
              <Bell className="h-4 w-4 text-[#009B3A]" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor={`case-toggle-${uc.id}`} className="text-sm font-medium">
                Notifications
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {enabled ? "Enabled for this case" : "Disabled for this case"}
              </p>
            </div>
          </div>
          <Switch
            id={`case-toggle-${uc.id}`}
            checked={enabled}
            disabled={saving}
            onCheckedChange={(v) => setAll(v)}
          />
        </div>
      </div>

      {/* Alert types */}
      <div
        className={cn(
          "rounded-3xl border border-foreground/[0.07] bg-card overflow-hidden transition-opacity duration-200",
          !enabled && "opacity-40",
        )}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alert me
          </p>
        </div>
        <div className="divide-y divide-foreground/[0.05]">
          {ALERTS.map(({ id, label, description }) => {
            const active = settings[id];
            return (
              <button
                key={id}
                type="button"
                disabled={saving}
                onClick={() => toggleAlert(id)}
                className="flex w-full items-center justify-between px-4 py-3.5 hover:bg-foreground/[0.025] transition-colors text-left disabled:cursor-wait"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200",
                      active
                        ? "border-[#009B3A] bg-[#009B3A]"
                        : "border-foreground/[0.15] bg-transparent",
                    )}
                  >
                    {active && (
                      <svg viewBox="0 0 10 8" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] text-muted-foreground">
            Delivered: <span className="text-foreground font-medium">In-app &amp; email</span>
            <span className="ml-1 text-foreground/55">(email can be paused above)</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Active Notifications List ── */

function ActiveNotifsList({
  trackedCases,
  judgments,
}: {
  trackedCases: UserCase[];
  judgments: Judgment[];
}) {
  const items = trackedCases.flatMap((uc) => {
    const s = settingsFor(uc);
    const { title } = caseLabel(uc, judgments);
    return ALERTS.filter((a) => s[a.id]).map((a) => ({
      key: `${uc.id}-${a.id}`,
      title,
      timing: a.label,
    }));
  });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-foreground/[0.05] bg-card py-12 text-center px-4">
        <Bell className="mb-3 h-10 w-10 text-foreground/10" />
        <p className="text-sm text-foreground/70">No alerts scheduled</p>
        <p className="mt-1 text-[12px] text-foreground/55">
          Track a case and enable alert types above.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-foreground/[0.06] bg-card overflow-hidden divide-y divide-foreground/[0.05]">
      {items.map(({ key, title, timing }) => (
        <div key={key} className="flex items-center gap-3 px-4 py-3">
          <Bell className="h-3.5 w-3.5 text-[#009B3A] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground/80 truncate">{title}</p>
            <p className="text-[10px] text-foreground/65">{timing}</p>
          </div>
          <span className="text-[10px] rounded-full bg-[#009B3A]/10 border border-[#009B3A]/20 px-2 py-0.5 text-[#009B3A] font-medium shrink-0">
            Active
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Page ── */

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [trackedCases, setTrackedCases] = useState<UserCase[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [scanPrefs, setScanPrefs] = useState<ScanAlertPrefs>(DEFAULT_SCAN_ALERT_PREFS);
  const [scanSaving, setScanSaving] = useState(false);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "active">("settings");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [casesRes, judgementsRes, prefs] = await Promise.all([
          apiClient.getUserCases(),
          apiClient.getJudgments(),
          apiClient.getPreferences().catch(
            (): UserPreferences => ({
              email_notifications: true,
              notify_on_scan: DEFAULT_SCAN_ALERT_PREFS.enabled,
              scan_alert_channel: DEFAULT_SCAN_ALERT_PREFS.channel,
              scan_alert_frequency: DEFAULT_SCAN_ALERT_PREFS.frequency,
            }),
          ),
        ]);
        setTrackedCases(casesRes.cases);
        setJudgments(judgementsRes.judgments);
        setEmailEnabled(prefs.email_notifications);
        setScanPrefs({
          enabled: prefs.notify_on_scan,
          channel: prefs.scan_alert_channel,
          frequency: prefs.scan_alert_frequency,
        });
        if (casesRes.cases.length > 0) {
          setSelectedRowId(casesRes.cases[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch notification settings data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /** Persist per-case alert preferences to the backend, with optimistic UI and rollback. */
  const updateCaseSettings = useCallback(
    async (uc: UserCase, next: CaseNotifSettings) => {
      const previous = trackedCases;
      setTrackedCases((prev) =>
        prev.map((row) => (row.id === uc.id ? { ...row, ...next } : row)),
      );
      setSavingRowId(uc.id);
      try {
        await apiClient.updateCaseSettings(uc.id, next);
        showToast("Alert preferences saved");
      } catch (err) {
        console.error("Failed to save alert preferences:", err);
        setTrackedCases(previous);
        showToast("Could not save — please try again");
      } finally {
        setSavingRowId(null);
      }
    },
    [trackedCases, showToast],
  );

  /** Persist the global email opt-in (users.email_notifications). */
  const updateEmailEnabled = useCallback(
    async (v: boolean) => {
      const previous = emailEnabled;
      setEmailEnabled(v);
      setEmailSaving(true);
      try {
        await apiClient.updatePreferences(v, false);
        showToast(v ? "Email alerts resumed" : "Email alerts paused");
      } catch (err) {
        console.error("Failed to save email preference:", err);
        setEmailEnabled(previous);
        showToast("Could not save — please try again");
      } finally {
        setEmailSaving(false);
      }
    },
    [emailEnabled, showToast],
  );

  /** Persist the scan-alert preferences (users.notify_on_scan / channel / frequency). */
  const updateScanPrefs = useCallback(
    async (next: ScanAlertPrefs) => {
      const previous = scanPrefs;
      setScanPrefs(next);
      setScanSaving(true);
      try {
        await apiClient.updatePreferences(emailEnabled, false, {
          notify_on_scan: next.enabled,
          scan_alert_channel: next.channel,
          scan_alert_frequency: next.frequency,
        });
        showToast(next.enabled ? "Scan alert preferences saved" : "Scan alerts off");
      } catch (err) {
        console.error("Failed to save scan preference:", err);
        setScanPrefs(previous);
        showToast("Could not save — please try again");
      } finally {
        setScanSaving(false);
      }
    },
    [scanPrefs, emailEnabled, showToast],
  );

  const selectedCase = trackedCases.find((uc) => uc.id === selectedRowId) ?? null;

  return (
    <AuthGuard>
      <div className="relative min-h-screen bg-background">
        <div className="glass-backdrop" aria-hidden="true" />
        <Navbar />

        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-16">
          {/* Header */}
          <div className="mb-7">
            <button
              onClick={() => router.push("/settings")}
              className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              Back to Settings
            </button>
            <div className="mb-2.5 flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                Alerts
              </span>
            </div>
            <h1 className="text-[2.2rem] sm:text-[2.8rem] font-extrabold leading-none tracking-[-0.04em] text-foreground">
              Notification Settings
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Manage alert schedules for your tracked cases
            </p>
          </div>

          {/* Global settings strip */}
          <div className="mb-6 rounded-3xl border border-foreground/[0.07] bg-card p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Email alerts */}
              <div className="flex items-center justify-between flex-1 gap-4 sm:self-start">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <Label htmlFor="email-toggle" className="text-sm font-medium">
                      Email Alerts
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {emailEnabled
                        ? "Case alerts are also sent to your email"
                        : "Paused — alerts appear in-app only"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-toggle"
                  checked={emailEnabled}
                  disabled={emailSaving}
                  onCheckedChange={(v) => updateEmailEnabled(v)}
                />
              </div>

              <div className="h-px sm:h-auto sm:w-px bg-foreground/[0.07]" />

              {/* Scan alerts */}
              <div className="flex-1 min-w-0">
                <ScanAlertSettings
                  idPrefix="notif-scan"
                  value={scanPrefs}
                  onChange={(next) => updateScanPrefs(next)}
                  disabled={scanSaving}
                  emailEnabled={emailEnabled}
                />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              New cases you track start with every alert type on. The courts are
              checked each weekday around 6 AM, 10 AM and 2 PM, with a reminder
              pass on weekend mornings.
            </p>
          </div>

          {/* Tabs: Settings / Active */}
          <div className="mb-5 flex gap-0.5 rounded-full glass-panel p-1">
            {(["settings", "active"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[12px] font-semibold capitalize transition-all duration-150",
                  activeTab === tab
                    ? "bg-[#009B3A] text-white"
                    : "text-foreground/70 hover:text-foreground/90",
                )}
              >
                {tab === "settings" ? "Case Alerts" : "Active Alerts"}
              </button>
            ))}
          </div>

          {activeTab === "active" ? (
            <ActiveNotifsList trackedCases={trackedCases} judgments={judgments} />
          ) : loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-3xl border border-foreground/[0.06] bg-card"
                />
              ))}
            </div>
          ) : trackedCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-foreground/[0.05] bg-card py-16 text-center">
              <Bell className="mb-3 h-10 w-10 text-foreground/10" />
              <p className="text-sm text-foreground/70">No tracked cases</p>
              <p className="mt-1 text-[12px] text-foreground/55">
                Track a case to set up custom alert schedules.
              </p>
              <button
                onClick={() => router.push("/cases")}
                className="mt-4 rounded-full border border-[#009B3A]/25 bg-[#009B3A]/10 px-4 py-2.5 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/15 transition-colors"
              >
                Browse Cases
              </button>
            </div>
          ) : (
            /* ── Two-panel layout ── */
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              {/* Left: Case list */}
              <div className="rounded-3xl border border-foreground/[0.07] bg-card overflow-hidden h-fit">
                <div className="px-4 py-3 border-b border-foreground/[0.06]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tracked Cases
                  </p>
                </div>
                <div className="divide-y divide-foreground/[0.05]">
                  {trackedCases.map((uc) => {
                    const { title, court } = caseLabel(uc, judgments);
                    const enabled = anyEnabled(settingsFor(uc));
                    const selected = selectedRowId === uc.id;
                    return (
                      <button
                        key={uc.id}
                        onClick={() => {
                          setSelectedRowId(uc.id);
                          setMobileSheetOpen(true);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          selected
                            ? "bg-[#009B3A]/[0.07]"
                            : "hover:bg-foreground/[0.025]",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors",
                            enabled ? "bg-[#009B3A]/15" : "bg-foreground/[0.05]",
                          )}
                        >
                          <Bell
                            className={cn(
                              "h-3.5 w-3.5",
                              enabled ? "text-[#009B3A]" : "text-foreground/60",
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground/80 truncate">
                            {title}
                          </p>
                          {court && (
                            <p className="text-[10px] text-foreground/65 truncate">{court}</p>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Settings panel — desktop only */}
              <div className="hidden lg:block">
                {selectedCase ? (
                  <CasePanel
                    uc={selectedCase}
                    judgments={judgments}
                    settings={settingsFor(selectedCase)}
                    saving={savingRowId === selectedCase.id}
                    onUpdate={(s) => updateCaseSettings(selectedCase, s)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 rounded-3xl border border-foreground/[0.06] text-foreground/60 text-sm">
                    Select a case to manage alerts
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ── Mobile: bottom sheet for case settings ── */}
        {mobileSheetOpen && selectedCase && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSheetOpen(false)}
            />
            <div
              className="lg:hidden fixed bottom-0 inset-x-0 z-[75] rounded-t-[28px] bg-card border-t border-foreground/[0.1] flex flex-col max-h-[85vh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-foreground/[0.12]" />
              <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/[0.07]">
                <p className="text-sm font-semibold text-foreground">Case Alerts</p>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="rounded-full p-1.5 text-foreground/70 hover:text-foreground hover:bg-foreground/[0.07]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-5">
                <CasePanel
                  uc={selectedCase}
                  judgments={judgments}
                  settings={settingsFor(selectedCase)}
                  saving={savingRowId === selectedCase.id}
                  onUpdate={(s) => updateCaseSettings(selectedCase, s)}
                />
              </div>
            </div>
          </>
        )}

        {/* Toast */}
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthGuard>
  );
}
