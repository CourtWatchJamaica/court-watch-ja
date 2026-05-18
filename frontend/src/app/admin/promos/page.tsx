"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import type { Promo } from "@/lib/types";
import ConfirmModal from "@/components/ConfirmModal";

const inputCls =
  "w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 focus:bg-black/50 transition-colors";

const FREQUENCIES = [
  { value: "once", label: "Once (never show again after dismissal)" },
  { value: "daily", label: "Daily (once per day)" },
  { value: "weekly", label: "Weekly (once per 7 days)" },
  { value: "every_session", label: "Every session (always show)" },
];

interface FormState {
  title: string;
  message: string;
  url: string;
  url_text: string;
  display_frequency: string;
  starts_at: string;
  ends_at: string;
  enabled: boolean;
}

const EMPTY: FormState = {
  title: "",
  message: "",
  url: "",
  url_text: "",
  display_frequency: "once",
  starts_at: "",
  ends_at: "",
  enabled: true,
};

function promoToForm(p: Promo): FormState {
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    return iso.slice(0, 16);
  };
  return {
    title: p.title,
    message: p.message,
    url: p.url ?? "",
    url_text: p.url_text ?? "",
    display_frequency: p.display_frequency,
    starts_at: toLocal(p.starts_at),
    ends_at: toLocal(p.ends_at),
    enabled: p.enabled,
  };
}

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.adminListPromos();
      setPromos(res.promos);
    } catch {
      setError("Failed to load promos");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (p: Promo) => {
    setEditingId(p.id);
    setForm(promoToForm(p));
    setSaved(false);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      url: form.url.trim() || undefined,
      url_text: form.url_text.trim() || undefined,
      display_frequency: form.display_frequency,
      starts_at: form.starts_at || undefined,
      ends_at: form.ends_at || undefined,
      enabled: form.enabled,
    };

    try {
      if (editingId !== null) {
        const res = await apiClient.adminUpdatePromo(editingId, payload);
        setPromos((prev) =>
          prev.map((p) => (p.id === editingId ? res.promo : p)),
        );
        setEditingId(null);
        setForm(EMPTY);
      } else {
        const res = await apiClient.adminCreatePromo(payload);
        setPromos((prev) => [res.promo, ...prev]);
        setForm(EMPTY);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save promo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.adminDeletePromo(deleteTarget.id);
      setPromos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) handleCancelEdit();
    } catch {
      setError("Failed to delete promo");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-[#FED100]" />
        <div>
          <h1 className="text-xl font-bold text-white">Promo Popups</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Manage promotional popups shown to authenticated users
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mb-8 rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40 mb-4">
          {editingId !== null ? "Edit Promo" : "New Promo"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. New Feature: Parish Court Search"
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              className={inputCls + " resize-none"}
              rows={3}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="Describe the promotion or announcement…"
              maxLength={500}
            />
            <p className="mt-1 text-right text-[10px] text-white/20">
              {form.message.length}/500
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                CTA URL
              </label>
              <input
                className={inputCls}
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                CTA Button Text
              </label>
              <input
                className={inputCls}
                value={form.url_text}
                onChange={(e) => set("url_text", e.target.value)}
                placeholder="Learn More"
                maxLength={40}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
              Display Frequency
            </label>
            <select
              className={inputCls}
              value={form.display_frequency}
              onChange={(e) => set("display_frequency", e.target.value)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                Starts At
              </label>
              <input
                type="datetime-local"
                className={inputCls}
                value={form.starts_at}
                onChange={(e) => set("starts_at", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                Ends At
              </label>
              <input
                type="datetime-local"
                className={inputCls}
                value={form.ends_at}
                onChange={(e) => set("ends_at", e.target.value)}
              />
            </div>
          </div>

          {/* Enabled toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set("enabled", !form.enabled)}
              className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                form.enabled ? "bg-[#009B3A]" : "bg-white/[0.12]"
              }`}
            >
              <span
                className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                  form.enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-xs text-white/50">
              {form.enabled ? "Enabled — will show to users" : "Disabled"}
            </span>
          </label>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/[0.06] px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-[#009B3A] shrink-0" />
              <p className="text-sm font-semibold text-[#009B3A]">
                Promo saved successfully
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.message.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#009B3A] py-3 text-sm font-bold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  {editingId !== null ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingId !== null ? "Update Promo" : "Create Promo"}
                </>
              )}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-3 text-sm text-white/50 hover:bg-white/[0.04] hover:text-white/70 transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Promo list */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40 mb-3">
          Existing Promos ({promos.length})
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/30 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : promos.length === 0 ? (
          <p className="text-sm text-white/25 py-4">No promos yet.</p>
        ) : (
          <div className="space-y-3">
            {promos.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  editingId === p.id
                    ? "border-[#009B3A]/30 bg-[#009B3A]/[0.04]"
                    : "border-white/[0.07] bg-[#0d0d1a]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">
                        {p.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          p.enabled
                            ? "bg-[#009B3A]/15 text-[#009B3A]"
                            : "bg-white/[0.06] text-white/30"
                        }`}
                      >
                        {p.enabled ? "Active" : "Disabled"}
                      </span>
                      <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                        {p.display_frequency}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/45 line-clamp-2">
                      {p.message}
                    </p>
                    {(p.starts_at || p.ends_at) && (
                      <p className="mt-1 text-[10px] text-white/25">
                        {p.starts_at && `From ${p.starts_at.slice(0, 10)}`}
                        {p.starts_at && p.ends_at && " → "}
                        {p.ends_at && `Until ${p.ends_at.slice(0, 10)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleEdit(p)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Promo"
          message={`Delete "${deleteTarget.title}"? This cannot be undone.`}
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          confirmClassName="bg-red-500 hover:bg-red-500/85 text-white"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
