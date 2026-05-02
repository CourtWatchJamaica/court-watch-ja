"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { UserCase, Judgment } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Bell,
  BellOff,
  Scale,
  X,
  ChevronRight,
  Building2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */

type Timing = "10min" | "1hour" | "1day";

interface CaseNotifSettings {
  enabled: boolean;
  timings: Timing[];
}

interface NotifSettings {
  doNotDisturb: boolean;
  defaultTimings: Timing[];
  cases: Record<number, CaseNotifSettings>;
}

const STORAGE_KEY = "cwja_notif_settings";
const TIMINGS: { id: Timing; label: string; description: string }[] = [
  { id: "10min", label: "10 minutes before", description: "A quick reminder just before the sitting" },
  { id: "1hour", label: "1 hour before", description: "Enough time to prepare and travel" },
  { id: "1day", label: "1 day before", description: "Evening reminder the day before" },
];

/* ── Helpers ── */

function loadSettings(): NotifSettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as NotifSettings;
  } catch {}
  return defaultSettings();
}

function defaultSettings(): NotifSettings {
  return { doNotDisturb: false, defaultTimings: ["1day"], cases: {} };
}

function saveSettings(s: NotifSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

/* ── Toast ── */

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0d0d1a]/95 px-4 py-2.5 shadow-lg backdrop-blur-xl">
      <Bell className="h-3.5 w-3.5 text-[#009B3A]" />
      <span className="text-[12px] font-medium text-white">{message}</span>
    </div>
  );
}

/* ── Case Notification Panel ── */

function CasePanel({
  caseId,
  judgment,
  settings,
  onUpdate,
}: {
  caseId: number;
  judgment: Judgment | null;
  settings: CaseNotifSettings;
  onUpdate: (s: CaseNotifSettings) => void;
}) {
  const title = judgment?.title || `Case #${caseId}`;
  const court = judgment?.court ?? "Supreme Court";
  const citation = judgment?.case_number ?? null;

  const toggleTiming = (t: Timing) => {
    const timings = settings.timings.includes(t)
      ? settings.timings.filter((x) => x !== t)
      : [...settings.timings, t];
    onUpdate({ ...settings, timings });
  };

  return (
    <div className="flex-1 space-y-5">
      {/* Case info */}
      <div className="rounded-xl border border-white/[0.07] bg-[#0d0d1a] p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 rounded-full bg-[#009B3A]/10 border border-[#009B3A]/20 px-2.5 py-1">
            <Scale className="h-3 w-3 text-[#009B3A]" />
            <span className="text-[10px] font-semibold text-[#009B3A]">{court}</span>
          </div>
        </div>
        <p className="text-[14px] font-semibold text-foreground leading-snug">{title}</p>
        {citation && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{citation}</p>
        )}
      </div>

      {/* Master toggle */}
      <div className="rounded-xl border border-white/[0.07] bg-[#0d0d1a] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {settings.enabled ? (
              <Bell className="h-4 w-4 text-[#009B3A]" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor={`case-toggle-${caseId}`} className="text-sm font-medium">
                Notifications
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {settings.enabled ? "Enabled for this case" : "Disabled for this case"}
              </p>
            </div>
          </div>
          <Switch
            id={`case-toggle-${caseId}`}
            checked={settings.enabled}
            onCheckedChange={(v) => onUpdate({ ...settings, enabled: v })}
          />
        </div>
      </div>

      {/* Alert timings */}
      <div
        className={cn(
          "rounded-xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden transition-opacity duration-200",
          !settings.enabled && "opacity-40 pointer-events-none",
        )}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alert me
          </p>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {TIMINGS.map(({ id, label, description }) => {
            const active = settings.timings.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleTiming(id)}
                className="flex w-full items-center justify-between px-4 py-3.5 hover:bg-white/[0.025] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200",
                      active
                        ? "border-[#009B3A] bg-[#009B3A]"
                        : "border-white/[0.15] bg-transparent",
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
            Method: <span className="text-foreground font-medium">In-app</span>
            <span className="ml-1 text-white/25">(email &amp; push coming soon)</span>
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
  settings,
}: {
  trackedCases: UserCase[];
  judgments: Judgment[];
  settings: NotifSettings;
}) {
  const items = trackedCases.flatMap((uc) => {
    const cs = settings.cases[uc.case_id];
    if (!cs?.enabled || cs.timings.length === 0) return [];
    const j = judgments.find((x) => x.id === uc.case_id);
    const title = j?.title || `Case #${uc.case_id}`;
    return cs.timings.map((t) => ({
      key: `${uc.case_id}-${t}`,
      title,
      timing: TIMINGS.find((x) => x.id === t)?.label ?? t,
    }));
  });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-12 text-center px-4">
        <Bell className="mb-3 h-10 w-10 text-white/10" />
        <p className="text-sm text-white/40">No alerts scheduled</p>
        <p className="mt-1 text-[12px] text-white/25">
          Track a case and enable notification timings above.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d1a] overflow-hidden divide-y divide-white/[0.05]">
      {items.map(({ key, title, timing }) => (
        <div key={key} className="flex items-center gap-3 px-4 py-3">
          <Bell className="h-3.5 w-3.5 text-[#009B3A] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-white/80 truncate">{title}</p>
            <p className="text-[10px] text-white/35">{timing}</p>
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
  const [settings, setSettings] = useState<NotifSettings>(defaultSettings());
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "active">("settings");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [casesRes, judgementsRes] = await Promise.all([
          apiClient.getUserCases(),
          apiClient.getJudgments(),
        ]);
        setTrackedCases(casesRes.cases);
        setJudgments(judgementsRes.judgments);
        if (casesRes.cases.length > 0) {
          setSelectedCaseId(casesRes.cases[0].case_id);
        }
      } catch (err) {
        console.error("Failed to fetch notification settings data:", err);
      } finally {
        setLoading(false);
      }
    };
    const loaded = loadSettings();
    setSettings(loaded);
    fetchData();
  }, []);

  const updateCaseSettings = useCallback(
    (caseId: number, cs: CaseNotifSettings) => {
      setSettings((prev) => {
        const next = { ...prev, cases: { ...prev.cases, [caseId]: cs } };
        saveSettings(next);
        return next;
      });
      showToast("Alert preferences saved");
    },
    [showToast],
  );

  const updateGlobal = useCallback(
    (patch: Partial<NotifSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const getCaseSettings = (caseId: number): CaseNotifSettings =>
    settings.cases[caseId] ?? { enabled: false, timings: settings.defaultTimings };

  const selectedJudgment = judgments.find((j) => j.id === selectedCaseId) ?? null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-16">
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Notification Settings
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Manage alert schedules for your tracked cases
            </p>
          </div>

          {/* Global settings strip */}
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Do Not Disturb */}
              <div className="flex items-center justify-between flex-1 gap-4">
                <div className="flex items-center gap-2.5">
                  <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <Label htmlFor="dnd-toggle" className="text-sm font-medium">
                      Do Not Disturb
                    </Label>
                    <p className="text-[11px] text-muted-foreground">Pause all notifications</p>
                  </div>
                </div>
                <Switch
                  id="dnd-toggle"
                  checked={settings.doNotDisturb}
                  onCheckedChange={(v) => updateGlobal({ doNotDisturb: v })}
                />
              </div>

              <div className="h-px sm:h-auto sm:w-px bg-white/[0.07]" />

              {/* Default timing */}
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Default Alert (new cases)
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {TIMINGS.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() =>
                        updateGlobal({
                          defaultTimings: settings.defaultTimings.includes(id)
                            ? settings.defaultTimings.filter((x) => x !== id)
                            : [...settings.defaultTimings, id],
                        })
                      }
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all duration-150",
                        settings.defaultTimings.includes(id)
                          ? "border-[#009B3A]/50 bg-[#009B3A]/15 text-[#009B3A]"
                          : "border-white/[0.1] text-white/40 hover:border-white/25 hover:text-white/60",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs: Settings / Active */}
          <div className="mb-5 flex gap-0.5 rounded-xl bg-white/[0.04] p-1">
            {(["settings", "active"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-[12px] font-semibold capitalize transition-all duration-150",
                  activeTab === tab
                    ? "bg-[#009B3A] text-white"
                    : "text-white/40 hover:text-white/60",
                )}
              >
                {tab === "settings" ? "Case Alerts" : "Active Alerts"}
              </button>
            ))}
          </div>

          {activeTab === "active" ? (
            <ActiveNotifsList
              trackedCases={trackedCases}
              judgments={judgments}
              settings={settings}
            />
          ) : loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-white/[0.06] bg-[#0d0d1a]"
                />
              ))}
            </div>
          ) : trackedCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-16 text-center">
              <Bell className="mb-3 h-10 w-10 text-white/10" />
              <p className="text-sm text-white/40">No tracked cases</p>
              <p className="mt-1 text-[12px] text-white/25">
                Track a case from the Cases page to set up alerts.
              </p>
            </div>
          ) : (
            /* ── Two-panel layout ── */
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              {/* Left: Case list */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden h-fit">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tracked Cases
                  </p>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {trackedCases.map((uc) => {
                    const j = judgments.find((x) => x.id === uc.case_id);
                    const cs = getCaseSettings(uc.case_id);
                    const selected = selectedCaseId === uc.case_id;
                    return (
                      <button
                        key={uc.id}
                        onClick={() => {
                          setSelectedCaseId(uc.case_id);
                          setMobileSheetOpen(true);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          selected
                            ? "bg-[#009B3A]/[0.07]"
                            : "hover:bg-white/[0.025]",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                            cs.enabled
                              ? "bg-[#009B3A]/15"
                              : "bg-white/[0.05]",
                          )}
                        >
                          <Bell
                            className={cn(
                              "h-3.5 w-3.5",
                              cs.enabled ? "text-[#009B3A]" : "text-white/30",
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-white/80 truncate">
                            {j?.title || `Case #${uc.case_id}`}
                          </p>
                          {j?.court && (
                            <p className="text-[10px] text-white/35 truncate">{j.court}</p>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-white/20 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Settings panel — desktop only */}
              <div className="hidden lg:block">
                {selectedCaseId !== null ? (
                  <CasePanel
                    caseId={selectedCaseId}
                    judgment={selectedJudgment}
                    settings={getCaseSettings(selectedCaseId)}
                    onUpdate={(cs) => updateCaseSettings(selectedCaseId, cs)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 rounded-2xl border border-white/[0.06] text-white/30 text-sm">
                    Select a case to manage alerts
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ── Mobile: bottom sheet for case settings ── */}
        {mobileSheetOpen && selectedCaseId !== null && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSheetOpen(false)}
            />
            <div
              className="lg:hidden fixed bottom-0 inset-x-0 z-[75] rounded-t-2xl bg-[#0d0d1a] border-t border-white/[0.1] flex flex-col max-h-[85vh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-white/[0.12]" />
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07]">
                <p className="text-sm font-semibold text-white">Case Alerts</p>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/[0.07]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-5">
                <CasePanel
                  caseId={selectedCaseId}
                  judgment={selectedJudgment}
                  settings={getCaseSettings(selectedCaseId)}
                  onUpdate={(cs) => {
                    updateCaseSettings(selectedCaseId, cs);
                  }}
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
