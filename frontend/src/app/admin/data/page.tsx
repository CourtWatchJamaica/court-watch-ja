"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { CourtSitting, Judgment } from "@/lib/types";
import {
  Database,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

type Tab = "judgments" | "sittings";
const PAGE_SIZE = 50;
const COURTS = ["Supreme Court", "Court of Appeal", "Parish Court"];
const DIVISIONS = [
  "Commercial Division",
  "Civil Division",
  "Court of Appeal",
  "Parish Court",
  "Family Division",
  "Revenue Court",
];

// ── Field ────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 focus:bg-black/50 transition-colors";
const selectCls =
  "w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#009B3A]/50 transition-colors";

// ── Modal shell ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0d0d1a] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Add Judgment Form ─────────────────────────────────────────────────────

function AddJudgmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (j: Judgment) => void;
}) {
  const [form, setForm] = useState({
    case_number: "",
    title: "",
    judge_name: "",
    court: "Supreme Court",
    date: "",
    pdf_url: "",
    summary_text: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.case_number.trim()) { setError("Case number is required"); return; }
    setSaving(true); setError(null);
    try {
      const { judgment } = await apiClient.adminCreateJudgment({
        case_number: form.case_number.trim(),
        title: form.title || undefined,
        judge_name: form.judge_name || undefined,
        court: form.court || undefined,
        date: form.date || undefined,
        pdf_url: form.pdf_url || undefined,
        summary_text: form.summary_text || undefined,
      });
      onCreated(judgment);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create judgment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Judgment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{error}</div>
        )}
        <Field label="Case Number" required>
          <input className={inputCls} value={form.case_number} onChange={(e) => set("case_number", e.target.value)} placeholder="e.g. 2026/HCV/00001" />
        </Field>
        <Field label="Title">
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Smith v Attorney General" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Judge Name">
            <input className={inputCls} value={form.judge_name} onChange={(e) => set("judge_name", e.target.value)} placeholder="Hon. Justice …" />
          </Field>
          <Field label="Court">
            <select className={selectCls} value={form.court} onChange={(e) => set("court", e.target.value)}>
              {COURTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="PDF URL">
            <input className={inputCls} value={form.pdf_url} onChange={(e) => set("pdf_url", e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Summary">
          <textarea className={inputCls + " resize-none"} rows={3} value={form.summary_text} onChange={(e) => set("summary_text", e.target.value)} placeholder="Brief summary…" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm text-white/40 hover:bg-white/[0.05] hover:text-white transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="min-h-[44px] flex items-center gap-2 rounded-xl bg-[#009B3A] px-5 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving…" : "Add Judgment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Add Sitting Form ──────────────────────────────────────────────────────

function AddSittingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: CourtSitting) => void;
}) {
  const [form, setForm] = useState({
    case_number: "",
    title: "",
    judge_name: "",
    court_division: "Civil Division",
    event_type: "",
    event_date: "",
    event_time: "",
    lawyers: "",
    pdf_source_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const { sitting } = await apiClient.adminCreateSitting({
        case_number: form.case_number || undefined,
        title: form.title || undefined,
        judge_name: form.judge_name || undefined,
        court_division: form.court_division || undefined,
        event_type: form.event_type || undefined,
        event_date: form.event_date || undefined,
        event_time: form.event_time || undefined,
        lawyers: form.lawyers || undefined,
        pdf_source_url: form.pdf_source_url || undefined,
      });
      onCreated(sitting);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create sitting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Court Sitting" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Case Number">
            <input className={inputCls} value={form.case_number} onChange={(e) => set("case_number", e.target.value)} placeholder="e.g. SU2026CD00001" />
          </Field>
          <Field label="Court Division">
            <select className={selectCls} value={form.court_division} onChange={(e) => set("court_division", e.target.value)}>
              {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Title">
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Smith v Attorney General" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Judge Name">
            <input className={inputCls} value={form.judge_name} onChange={(e) => set("judge_name", e.target.value)} placeholder="Hon. Justice …" />
          </Field>
          <Field label="Event Type">
            <input className={inputCls} value={form.event_type} onChange={(e) => set("event_type", e.target.value)} placeholder="e.g. Trial, Hearing" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={inputCls} value={form.event_date} onChange={(e) => set("event_date", e.target.value)} />
          </Field>
          <Field label="Time">
            <input type="time" className={inputCls} value={form.event_time} onChange={(e) => set("event_time", e.target.value)} />
          </Field>
        </div>
        <Field label="Lawyers">
          <input className={inputCls} value={form.lawyers} onChange={(e) => set("lawyers", e.target.value)} placeholder="e.g. Myers Fletcher & Gordon; DunnCox" />
        </Field>
        <Field label="PDF Source URL">
          <input className={inputCls} value={form.pdf_source_url} onChange={(e) => set("pdf_source_url", e.target.value)} placeholder="https://…" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm text-white/40 hover:bg-white/[0.05] hover:text-white transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="min-h-[44px] flex items-center gap-2 rounded-xl bg-[#009B3A] px-5 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving…" : "Add Sitting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Inline edit cell ───────────────────────────────────────────────────────

function EditCell({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (!editing) {
    return (
      <button
        className="group flex items-center gap-1 text-left text-xs text-white/60 hover:text-white transition-colors min-h-[44px]"
        onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      >
        <span className="line-clamp-1 max-w-[160px]">{value || <em className="text-white/20">—</em>}</span>
        <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 min-h-[44px]">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-8 rounded border border-[#009B3A]/40 bg-[#0d0d1a] px-2 text-xs text-white focus:outline-none w-32"
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#009B3A]">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setEditing(false)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/30">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Pagination bar ──────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-white/40">
      <span>{total.toLocaleString()} total</span>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {Math.max(1, totalPages)}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Judgments tab ──────────────────────────────────────────────────────────

function JudgmentsTab() {
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [courtFilter, setCourtFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; label: string } | null>(null);

  const load = useCallback(
    async (p: number, q: string, court: string) => {
      setLoading(true);
      try {
        const { judgments: rows, total: t } = await apiClient.adminListJudgments(
          p,
          PAGE_SIZE,
          q || undefined,
          court || undefined,
        );
        setJudgments(rows);
        setTotal(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(page, search, courtFilter);
  }, [load, page, search, courtFilter]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleCourtChange = (v: string) => {
    setCourtFilter(v);
    setPage(1);
  };

  const handleUpdate = async (id: number, field: string, value: string) => {
    try {
      const { judgment } = await apiClient.adminUpdateJudgment(id, { [field]: value });
      setJudgments((prev) => prev.map((j) => (j.id === id ? judgment : j)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      await apiClient.adminDeleteJudgment(id);
      setJudgments((prev) => prev.filter((j) => j.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {showAdd && (
        <AddJudgmentModal
          onClose={() => setShowAdd(false)}
          onCreated={(j) => { setJudgments((prev) => [j, ...prev]); setTotal((t) => t + 1); }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete judgment?"
          message={`"${confirmDelete.label}" will be permanently removed.`}
          confirmLabel="Delete Judgment"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {error && (
        <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Search / filter bar */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search case no. or title…"
            className="h-[44px] w-full rounded-xl border border-white/[0.08] bg-[#0d0d1a] pl-9 pr-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 transition-colors"
          />
        </div>
        <select
          value={courtFilter}
          onChange={(e) => handleCourtChange(e.target.value)}
          className="h-[44px] rounded-xl border border-white/[0.08] bg-[#0d0d1a] px-3 text-sm text-white/60 focus:outline-none focus:border-[#009B3A]/50 transition-colors"
        >
          <option value="">All courts</option>
          {COURTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
          <span className="text-xs text-white/30">{total.toLocaleString()} total</span>
          <button
            onClick={() => setShowAdd(true)}
            className="min-h-[44px] flex items-center gap-1.5 rounded-xl bg-[#009B3A]/15 border border-[#009B3A]/25 px-3 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/25 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Judgment
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["ID", "Case No.", "Title", "Judge", "Court", "Date", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 ${i === 0 ? "w-12" : i === 6 ? "w-10" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                        <td key={c} className="px-4 py-3"><div className="h-3 rounded bg-white/[0.05]" /></td>
                      ))}
                    </tr>
                  ))
                : judgments.map((j) => (
                    <tr key={j.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2 font-mono text-[10px] text-white/25">{j.id}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-white/50">{j.case_number}</td>
                      <td className="px-4 py-2"><EditCell value={j.title} onSave={(v) => handleUpdate(j.id, "title", v)} /></td>
                      <td className="px-4 py-2"><EditCell value={j.judge_name} onSave={(v) => handleUpdate(j.id, "judge_name", v)} /></td>
                      <td className="px-4 py-2"><EditCell value={j.court} onSave={(v) => handleUpdate(j.id, "court", v)} /></td>
                      <td className="px-4 py-2"><EditCell value={j.date} onSave={(v) => handleUpdate(j.id, "date", v)} /></td>
                      <td className="px-4 py-2">
                        {deletingId === j.id ? (
                          <Loader2 className="h-3.5 w-3.5 text-white/30 animate-spin" />
                        ) : (
                          <button
                            onClick={() => setConfirmDelete({ id: j.id, label: j.case_number })}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
}

// ── Sittings tab ───────────────────────────────────────────────────────────

function SittingsTab() {
  const [sittings, setSittings] = useState<CourtSitting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; label: string } | null>(null);

  const load = useCallback(
    async (p: number, q: string, division: string) => {
      setLoading(true);
      try {
        const { sittings: rows, total: t } = await apiClient.adminListSittings(
          p,
          PAGE_SIZE,
          q || undefined,
          division || undefined,
        );
        setSittings(rows);
        setTotal(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(page, search, divisionFilter);
  }, [load, page, search, divisionFilter]);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleDivisionChange = (v: string) => { setDivisionFilter(v); setPage(1); };

  const handleUpdate = async (id: number, field: string, value: string) => {
    try {
      const { sitting } = await apiClient.adminUpdateSitting(id, { [field]: value });
      setSittings((prev) => prev.map((s) => (s.id === id ? sitting : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      await apiClient.adminDeleteSitting(id);
      setSittings((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {showAdd && (
        <AddSittingModal
          onClose={() => setShowAdd(false)}
          onCreated={(s) => { setSittings((prev) => [s, ...prev]); setTotal((t) => t + 1); }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete sitting?"
          message={`"${confirmDelete.label}" will be permanently removed.`}
          confirmLabel="Delete Sitting"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {error && (
        <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Search / filter bar */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search case no. or title…"
            className="h-[44px] w-full rounded-xl border border-white/[0.08] bg-[#0d0d1a] pl-9 pr-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 transition-colors"
          />
        </div>
        <select
          value={divisionFilter}
          onChange={(e) => handleDivisionChange(e.target.value)}
          className="h-[44px] rounded-xl border border-white/[0.08] bg-[#0d0d1a] px-3 text-sm text-white/60 focus:outline-none focus:border-[#009B3A]/50 transition-colors"
        >
          <option value="">All divisions</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
          <span className="text-xs text-white/30">{total.toLocaleString()} total</span>
          <button
            onClick={() => setShowAdd(true)}
            className="min-h-[44px] flex items-center gap-1.5 rounded-xl bg-[#009B3A]/15 border border-[#009B3A]/25 px-3 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/25 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Sitting
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["ID", "Title", "Judge", "Division", "Date", "Time", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 ${i === 0 ? "w-12" : i === 6 ? "w-10" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                        <td key={c} className="px-4 py-3"><div className="h-3 rounded bg-white/[0.05]" /></td>
                      ))}
                    </tr>
                  ))
                : sittings.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2 font-mono text-[10px] text-white/25">{s.id}</td>
                      <td className="px-4 py-2"><EditCell value={s.title} onSave={(v) => handleUpdate(s.id, "title", v)} /></td>
                      <td className="px-4 py-2"><EditCell value={s.judge_name} onSave={(v) => handleUpdate(s.id, "judge_name", v)} /></td>
                      <td className="px-4 py-2 text-xs text-white/40">{s.court_division ?? "—"}</td>
                      <td className="px-4 py-2"><EditCell value={s.event_date} onSave={(v) => handleUpdate(s.id, "event_date", v)} /></td>
                      <td className="px-4 py-2"><EditCell value={s.event_time} onSave={(v) => handleUpdate(s.id, "event_time", v)} /></td>
                      <td className="px-4 py-2">
                        {deletingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 text-white/30 animate-spin" />
                        ) : (
                          <button
                            onClick={() => setConfirmDelete({ id: s.id, label: s.title ?? `#${s.id}` })}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(Math.max(1, totalPages), p + 1))}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminDataPage() {
  const [tab, setTab] = useState<Tab>("judgments");

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <Database className="h-5 w-5 text-[#009B3A]" />
        <div>
          <h1 className="text-xl font-bold text-white">Data</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Click any cell to edit inline. Changes save immediately.
          </p>
        </div>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl border border-white/[0.06] bg-[#0d0d1a] p-1 w-fit">
        {(["judgments", "sittings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-medium transition-colors ${
              tab === t ? "bg-white/[0.07] text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "judgments" ? <JudgmentsTab /> : <SittingsTab />}
    </div>
  );
}
