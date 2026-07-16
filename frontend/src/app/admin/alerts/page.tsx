"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  AlertOctagon,
  BellOff,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import type { ServiceAlert } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 focus:bg-black/50 transition-colors";

const SEVERITIES = [
  { value: "info",     label: "Info",     icon: Info,          color: "text-blue-400"  },
  { value: "warning",  label: "Warning",  icon: AlertTriangle, color: "text-amber-400" },
  { value: "critical", label: "Critical", icon: AlertOctagon,  color: "text-red-400"   },
];

const PREVIEW_STYLES: Record<string, string> = {
  info:     "border-b border-blue-500/20 bg-blue-500/[0.07]",
  warning:  "border-b border-amber-500/20 bg-amber-500/[0.07]",
  critical: "border-b border-red-500/20 bg-red-500/[0.08]",
};

export default function AdminAlertsPage() {
  const [current, setCurrent] = useState<ServiceAlert | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getServiceAlert()
      .then((res) => {
        if (res.alert?.enabled) {
          setCurrent(res.alert);
          setTitle(res.alert.title);
          setMessage(res.alert.message);
          setSeverity(res.alert.severity);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiClient.adminSetServiceAlert({
        title: title.trim() || undefined,
        message: message.trim(),
        severity,
        enabled: true,
      });
      setCurrent(res.alert);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save alert");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setError(null);
    try {
      await apiClient.adminSetServiceAlert({ enabled: false });
      setCurrent(null);
      setTitle("");
      setMessage("");
      setSeverity("info");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear alert");
    } finally {
      setClearing(false);
    }
  };

  const previewSev = SEVERITIES.find((s) => s.value === severity) ?? SEVERITIES[0];
  const PreviewIcon = previewSev.icon;

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Service Alert Banner</h1>
          <p className="text-xs text-white/70 mt-0.5">
            Show a dismissible banner at the top of every page
          </p>
        </div>
      </div>

      {/* Current active banner */}
      {current && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400 mb-1">
                Active Alert
              </p>
              <p className="text-sm text-white/75 font-medium">
                {current.title ? `${current.title}: ` : ""}
                {current.message}
              </p>
              <span
                className={`mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wide ${
                  previewSev.color
                }`}
              >
                {current.severity}
              </span>
            </div>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/50 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BellOff className="h-3.5 w-3.5" />
              )}
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-1.5">
            Title (optional)
          </label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled Maintenance"
            maxLength={80}
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-1.5">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            className={inputCls + " resize-none"}
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Brief message shown to all users…"
            maxLength={200}
          />
          <p className="mt-1 text-right text-[10px] text-white/50">
            {message.length}/200
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">
            Severity
          </label>
          <div className="flex gap-2">
            {SEVERITIES.map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                    severity === s.value
                      ? `border-current ${s.color} bg-white/[0.05]`
                      : "border-white/[0.1] text-white/65 hover:border-white/20 hover:text-white/55"
                  }`}
                >
                  <SIcon className="h-4 w-4" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {message && (
          <div className="rounded-xl overflow-hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55 mb-2">
              Preview
            </p>
            <div className={`${PREVIEW_STYLES[severity] ?? PREVIEW_STYLES.info} px-4 py-2.5 rounded-xl`}>
              <div className="flex items-start gap-3">
                <PreviewIcon className={`h-4 w-4 shrink-0 mt-0.5 ${previewSev.color}`} />
                <p className="text-sm leading-snug">
                  {title && (
                    <span className={`font-semibold ${previewSev.color}`}>
                      {title}:{" "}
                    </span>
                  )}
                  <span className="text-white/65">{message}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/[0.06] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-[#009B3A] shrink-0" />
            <p className="text-sm font-semibold text-[#009B3A]">
              Alert is now live for all users
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !message.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/80 py-3 text-sm font-bold text-black hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              Publish Alert
            </>
          )}
        </button>
      </form>
    </div>
  );
}
