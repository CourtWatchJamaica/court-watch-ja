"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { SystemConfigEntry } from "@/lib/types";
import { Settings, Check, X, Pencil, Loader2, RefreshCw } from "lucide-react";

const KEY_DESCRIPTIONS: Record<string, string> = {
  judgment_cutoff_date: "Judgments older than this date are ignored by the scraper (YYYY-MM-DD)",
  scrape_interval_hours: "How often the scheduled scraper runs (hours)",
  max_pdf_failures: "Number of download failures before a PDF URL is permanently skipped",
};

function ConfigRow({
  entry,
  onSave,
}: {
  entry: SystemConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (draft === entry.value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(entry.key, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0d0d1a] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono font-semibold text-white">{entry.key}</code>
          </div>
          {KEY_DESCRIPTIONS[entry.key] && (
            <p className="text-[11px] text-white/65 leading-relaxed mb-3">
              {KEY_DESCRIPTIONS[entry.key]}
            </p>
          )}

          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") { setDraft(entry.value); setEditing(false); }
                }}
                className="h-9 rounded-xl border border-[#009B3A]/40 bg-black/30 px-3 text-sm text-white font-mono focus:outline-none focus:border-[#009B3A] w-64"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-[#009B3A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                onClick={() => { setDraft(entry.value); setEditing(false); }}
                className="rounded-xl px-3 py-2 text-sm text-white/70 hover:text-white/90 hover:bg-white/[0.05] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <code className="rounded-lg bg-black/30 px-3 py-1.5 text-sm font-mono text-[#009B3A]">
                {entry.value}
              </code>
              <button
                onClick={() => { setDraft(entry.value); setEditing(true); }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/65 hover:bg-white/[0.05] hover:text-white/70 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] text-white/50">Last updated</p>
          <p className="text-[10px] text-white/65 mt-0.5">
            {new Date(entry.updated_at).toLocaleString("en-JM", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<SystemConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { config: rows } = await apiClient.adminGetConfig();
      setConfig(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (key: string, value: string) => {
    setError(null);
    try {
      await apiClient.adminSetConfig(key, value);
      setConfig((prev) =>
        prev.map((e) =>
          e.key === key
            ? { ...e, value, updated_at: new Date().toISOString() }
            : e,
        ),
      );
      showToast(`${key} updated`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save config");
      throw e;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">System Config</h1>
            <p className="text-xs text-white/70 mt-0.5">
              Runtime settings stored in the database. Changes take effect without restart.
            </p>
          </div>
        </div>
        <button
          onClick={fetchConfig}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/60 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-[#0d0d1a]" />
          ))}
        </div>
      ) : config.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-[#0d0d1a] py-16 text-center">
          <Settings className="h-8 w-8 text-white/10 mb-3" />
          <p className="text-sm text-white/60">No config entries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {config.map((entry) => (
            <ConfigRow key={entry.key} entry={entry} onSave={handleSave} />
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-3 shadow-2xl flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#009B3A]" />
          <p className="text-sm text-white/90">{toast}</p>
        </div>
      )}
    </div>
  );
}
