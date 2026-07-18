"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { formatDateOnly } from "@/lib/dates";
import { Judgment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useTracking } from "@/lib/tracking-context";
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  FileText,
  Download,
  Bookmark,
  BookmarkCheck,
  Scale,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";

/* ── Skeletons / states ─────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#0e0e1a] overflow-hidden animate-pulse">
      <div className="p-6 border-b border-white/[0.06] space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-28 rounded-full bg-white/[0.06]" />
          <div className="h-6 w-16 rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-7 w-3/4 rounded bg-white/[0.07]" />
        <div className="h-3.5 w-1/4 rounded bg-white/[0.04]" />
      </div>
      <div className="p-6 grid sm:grid-cols-2 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-12 rounded bg-white/[0.04]" />
            <div className="h-4 w-40 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="px-6 pb-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          <div className="h-3 w-16 rounded bg-white/[0.04]" />
          <div className="h-3 w-full rounded bg-white/[0.06]" />
          <div className="h-3 w-4/5 rounded bg-white/[0.05]" />
          <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

/* ── PDF picker modal (glass, bottom-sheet on mobile) ───────────────────────── */

function PdfPickerModal({
  judgment,
  onClose,
}: {
  judgment: Judgment;
  onClose: () => void;
}) {
  const [originalLoading, setOriginalLoading] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleOriginalDownload = async () => {
    setOriginalLoading(true);
    setOriginalError(null);
    try {
      const { url } = await apiClient.getOriginalPdfUrl(judgment.id);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        onClose();
      } else {
        setOriginalError(
          "Original PDF not found on the court website. You can download the CourtWatch Summary instead."
        );
      }
    } catch {
      setOriginalError(
        "Couldn't reach the court website. Try the CourtWatch Summary instead."
      );
    } finally {
      setOriginalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className="relative z-10 w-full sm:max-w-sm rounded-t-lg sm:rounded-lg border border-white/10 bg-[#0e0e1a] shadow-2xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Drag handle — mobile only */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/[0.12] sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#009B3A]">
              Download
            </p>
            <p className="text-[14px] font-semibold text-white leading-tight mt-0.5">
              Choose PDF
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2.5">
          {/* CourtWatch branded summary — uses local_pdf_path via backend PDF generator */}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/pdf/judgment/${judgment.id}`}
            onClick={onClose}
            className="group flex items-center gap-4 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/10 px-4 py-3.5 hover:bg-[#009B3A]/15 transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009B3A]/20">
              <FileText className="h-5 w-5 text-[#009B3A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#009B3A]">CourtWatch Summary</p>
              <p className="text-[11px] text-[#009B3A]/55 mt-0.5">Branded PDF with case overview</p>
            </div>
            <Download className="h-4 w-4 shrink-0 text-[#009B3A]/60 group-hover:text-[#009B3A] transition-colors" />
          </a>

          {/* Original court judgment — verified live from court website */}
          <button
            onClick={handleOriginalDownload}
            disabled={originalLoading}
            className="group w-full flex items-center gap-4 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 hover:bg-white/[0.07] disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
              {originalLoading ? (
                <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
              ) : (
                <Download className="h-5 w-5 text-white/60" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-semibold text-white/80">Original Judgment</p>
              <p className="text-[11px] text-white/70 mt-0.5">
                {originalLoading ? "Checking court website…" : "Official court document (PDF)"}
              </p>
            </div>
          </button>

          {/* Inline error message */}
          {originalError && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 text-[11px] leading-snug text-amber-400/90">
              {originalError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const { isTracked, track } = useTracking();

  const load = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    apiClient
      .getJudgment(params.id as string)
      .then(({ judgment: data }) => setJudgment(data))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const tracked = judgment ? isTracked(judgment.id, "judgment") : false;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-12">
          <button
            onClick={() => router.back()}
            className="mb-7 flex items-center gap-1.5 text-[12px] font-medium text-white/70 hover:text-white/90 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          {loading ? (
            <DetailSkeleton />
          ) : fetchError ? (
            /* Network / server error — offer retry */
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.07] bg-[#0e0e1a] py-16 text-center px-6 gap-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70">
                  Couldn&apos;t load this case
                </p>
                <p className="mt-1 text-xs text-white/65">
                  Check your connection and try again.
                </p>
              </div>
              <button
                onClick={load}
                className="flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : !judgment ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.07] bg-[#0e0e1a] py-16 text-center">
              <p className="text-sm text-white/70">Case not found.</p>
            </div>
          ) : (
            <div className="rounded-lg border-l-[3px] border-l-[#009B3A] border-t border-r border-b border-white/[0.08] bg-[#0e0e1a] overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {judgment.court && (
                        <span className="flex items-center gap-1.5 rounded-full bg-[#009B3A]/12 border border-[#009B3A]/25 px-2.5 py-1 text-[10px] font-semibold text-[#009B3A]">
                          <Scale className="h-3 w-3" />
                          {judgment.court}
                        </span>
                      )}
                      <Badge className="bg-white/[0.06] text-white/70 border border-white/[0.08] text-[10px] font-mono px-2.5 h-6 rounded-full">
                        Judgment
                      </Badge>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                      {judgment.title || judgment.case_number}
                    </h1>
                    {judgment.case_number && judgment.title && (
                      <p className="mt-2 font-mono text-[11px] text-[#009B3A]/50 tracking-wider">
                        {judgment.case_number}
                      </p>
                    )}
                  </div>

                  {/* Track button */}
                  {tracked ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/10 px-4 py-2.5 text-[12px] font-semibold text-[#009B3A]">
                      <BookmarkCheck className="h-3.5 w-3.5" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => track(judgment.id, "judgment")}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-[12px] font-semibold text-white/50 hover:border-[#009B3A]/40 hover:text-[#009B3A] hover:bg-[#009B3A]/[0.08] transition-colors"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      Track case
                    </button>
                  )}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="p-6 grid sm:grid-cols-2 gap-6">
                {judgment.judge_name && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55 mb-1.5">
                      Judge
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-white/75">
                      <User className="h-3.5 w-3.5 text-white/60 shrink-0" />
                      {judgment.judge_name}
                    </div>
                  </div>
                )}
                {judgment.date && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55 mb-1.5">
                      Date
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-white/75">
                      <Calendar className="h-3.5 w-3.5 text-white/60 shrink-0" />
                      {formatDateOnly(judgment.date, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                )}
                {judgment.court && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55 mb-1.5">
                      Court
                    </p>
                    <div className="flex items-center gap-2 text-[13px] text-white/75">
                      <Building2 className="h-3.5 w-3.5 text-white/60 shrink-0" />
                      {judgment.court}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              {judgment.summary_text && (
                <div className="px-6 pb-6">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-3.5 w-3.5 text-[#009B3A]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
                        Summary
                      </p>
                    </div>
                    <p className="text-[13px] text-white/65 leading-relaxed">
                      {judgment.summary_text}
                    </p>
                  </div>
                </div>
              )}

              {/* PDF download — opens picker modal */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => setPdfPickerOpen(true)}
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/10 px-4 py-2.5 text-[12px] font-semibold text-[#009B3A] hover:bg-[#009B3A]/15 transition-colors min-h-[44px]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                  <span className="font-mono text-[9px] font-normal text-[#009B3A]/50 group-hover:text-[#009B3A]/70 transition-colors">
                    Choose format
                  </span>
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.05]">
                <p className="text-[10px] text-white/50">
                  Created {new Date(judgment.created_at).toLocaleDateString("en-JM")} · Updated{" "}
                  {new Date(judgment.updated_at).toLocaleDateString("en-JM")}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PDF picker modal — rendered outside the main content so it overlays correctly */}
      {pdfPickerOpen && judgment && (
        <PdfPickerModal
          judgment={judgment}
          onClose={() => setPdfPickerOpen(false)}
        />
      )}
    </AuthGuard>
  );
}
