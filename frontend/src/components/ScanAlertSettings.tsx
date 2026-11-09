"use client";

import { useState } from "react";
import { Info, Radar, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* Mirrors users.scan_alert_channel / users.scan_alert_frequency on the backend. */
export type ScanAlertChannel = "in_app" | "both";
export type ScanAlertFrequency = "every_scan" | "daily" | "weekly";

export interface ScanAlertPrefs {
  enabled: boolean;
  channel: ScanAlertChannel;
  frequency: ScanAlertFrequency;
}

export const DEFAULT_SCAN_ALERT_PREFS: ScanAlertPrefs = {
  enabled: false,
  channel: "in_app",
  frequency: "daily",
};

const FREQUENCIES: { id: ScanAlertFrequency; label: string; hint: string }[] = [
  { id: "every_scan", label: "Every scan", hint: "After each check of your tracked cases — up to 3 a day on weekdays" },
  { id: "daily", label: "Daily", hint: "One summary of your tracked cases each morning" },
  { id: "weekly", label: "Weekly", hint: "One summary of your tracked cases a week" },
];

const CHANNELS: { id: ScanAlertChannel; label: string; hint: string }[] = [
  { id: "in_app", label: "In-app", hint: "Shows in your notifications" },
  { id: "both", label: "In-app + email", hint: "Also sent to your inbox" },
];

/**
 * Controlled editor for the Scan Alert preference. Persistence is up to the
 * parent: the Settings page batches it behind a Save button, the Notifications
 * page saves on every change.
 */
export function ScanAlertSettings({
  value,
  onChange,
  disabled = false,
  emailEnabled = true,
  idPrefix = "scan",
}: {
  value: ScanAlertPrefs;
  onChange: (next: ScanAlertPrefs) => void;
  disabled?: boolean;
  /** The user's global Email Notifications switch; when off, the email channel is moot. */
  emailEnabled?: boolean;
  idPrefix?: string;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Master row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Radar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`${idPrefix}-toggle`} className="text-sm font-medium">
                Scan Alerts
              </Label>
              <button
                type="button"
                onClick={() => setInfoOpen((o) => !o)}
                aria-expanded={infoOpen}
                aria-controls={`${idPrefix}-info`}
                aria-label="About scan alerts"
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                  infoOpen
                    ? "bg-[#009B3A]/15 text-[#009B3A]"
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                )}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {value.enabled
                ? `${FREQUENCIES.find((f) => f.id === value.frequency)?.label ?? "Daily"} summary, ${
                    value.channel === "both" ? "in-app and email" : "in-app only"
                  }`
                : "Only alerted when a tracked case changes"}
            </p>
          </div>
        </div>
        <Switch
          id={`${idPrefix}-toggle`}
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ ...value, enabled: v })}
        />
      </div>

      {/* Info panel */}
      {infoOpen && (
        <div
          id={`${idPrefix}-info`}
          role="note"
          className="relative rounded-2xl border border-[#009B3A]/20 bg-[#009B3A]/[0.06] px-4 py-3 pr-9 text-[12px] leading-relaxed text-foreground/80"
        >
          <button
            type="button"
            onClick={() => setInfoOpen(false)}
            aria-label="Close"
            className="absolute right-2 top-2 rounded-full p-1 text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="font-semibold text-foreground">What is a scan alert?</p>
          <p className="mt-1">
            Scan alerts are only about the cases you track. Every weekday
            around 6 AM, 10 AM and 2 PM, plus weekend mornings, CourtWatch JA
            checks the courts for changes to your tracked cases. You are always
            alerted when one of them changes.
          </p>
          <p className="mt-1.5">
            A scan alert is an extra summary confirming your tracked cases were
            checked, even when none of them changed. It says how many of your
            cases were checked and how many had updates since your last summary.
            If you are not tracking any cases, no scan alert is sent.
          </p>
          <p className="mt-1.5">
            By default you get one summary a day, in-app only. You can change
            how often it comes and whether it also goes to your email. Scan
            alerts are off until you turn them on.
          </p>
        </div>
      )}

      {/* Options — only meaningful when enabled */}
      {value.enabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset disabled={disabled} className="min-w-0">
            <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              How often
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCIES.map((f) => (
                <OptionChip
                  key={f.id}
                  active={value.frequency === f.id}
                  label={f.label}
                  hint={f.hint}
                  onClick={() => onChange({ ...value, frequency: f.id })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset disabled={disabled} className="min-w-0">
            <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Delivery
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => (
                <OptionChip
                  key={c.id}
                  active={value.channel === c.id}
                  label={c.label}
                  hint={c.hint}
                  onClick={() => onChange({ ...value, channel: c.id })}
                />
              ))}
            </div>
            {value.channel === "both" && !emailEnabled && (
              <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                Email Notifications is turned off, so this summary will stay in-app
                until you turn it back on.
              </p>
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
}

function OptionChip({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all duration-150 disabled:opacity-50",
        active
          ? "border-[#009B3A]/50 bg-[#009B3A]/15 text-[#009B3A]"
          : "border-foreground/[0.1] text-foreground/70 hover:border-foreground/25 hover:text-foreground/90",
      )}
    >
      {label}
    </button>
  );
}
