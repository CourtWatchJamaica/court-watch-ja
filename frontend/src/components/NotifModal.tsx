"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

export interface NotifSettings {
  notify_immediately: boolean;
  notify_day_before: boolean;
  notify_morning_of: boolean;
}

const NOTIF_ITEMS: { key: keyof NotifSettings; label: string; sub: string }[] = [
  { key: "notify_immediately", label: "When listed or updated",  sub: "Any change to this case" },
  { key: "notify_day_before",  label: "Day before the hearing",  sub: "Evening reminder" },
  { key: "notify_morning_of",  label: "Morning of the hearing",  sub: "Same-day alert at 7 AM" },
];

export function NotifModal({
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
        className="relative z-10 w-[90vw] max-w-[380px] rounded-lg border border-border bg-card shadow-2xl"
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
