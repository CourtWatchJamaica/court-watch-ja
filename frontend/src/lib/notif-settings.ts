export type Timing = "10min" | "1hour" | "1day";

export interface CaseNotifSettings {
  enabled: boolean;
  timings: Timing[];
}

export interface NotifSettings {
  doNotDisturb: boolean;
  defaultTimings: Timing[];
  cases: Record<number, CaseNotifSettings>;
}

const STORAGE_KEY = "cwja_notif_settings";

const DEFAULT_SETTINGS: NotifSettings = {
  doNotDisturb: false,
  defaultTimings: ["1hour"],
  cases: {},
};

export function loadNotifSettings(): NotifSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotifSettings(settings: NotifSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getAlertCount(caseId: number, settings?: NotifSettings): number {
  const s = settings ?? loadNotifSettings();
  const caseSettings = s.cases[caseId];
  if (!caseSettings || !caseSettings.enabled) return 0;
  return caseSettings.timings.length;
}
