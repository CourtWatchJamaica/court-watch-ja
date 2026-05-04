"use client";

import { useCallback, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { Upload, FileText, X, Loader2, CheckCircle2 } from "lucide-react";

const COURTS = ["Supreme Court", "Court of Appeal", "Parish Court"];
const DOC_TYPES = [
  { value: "judgment", label: "Judgment" },
  { value: "court_list", label: "Court List" },
];

interface UploadResult {
  extracted: number;
  message: string;
}

export default function AdminUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("judgment");
  const [court, setCourt] = useState("Supreme Court");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await apiClient.adminUploadPdf(
        file.name,
        base64,
        docType,
        court,
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const selectCls =
    "w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#009B3A]/50 transition-colors";

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Upload className="h-5 w-5 text-[#009B3A]" />
        <div>
          <h1 className="text-xl font-bold text-white">Upload PDF</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Manually upload a court PDF for OCR processing
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !file && inputRef.current?.click()}
        className={[
          "mb-5 relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer",
          dragging
            ? "border-[#009B3A] bg-[#009B3A]/[0.06]"
            : file
              ? "border-white/[0.12] bg-[#0d0d1a] cursor-default"
              : "border-white/[0.08] bg-[#0d0d1a] hover:border-white/[0.18] hover:bg-white/[0.02]",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleInputChange}
        />

        {file ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009B3A]/15">
              <FileText className="h-5 w-5 text-[#009B3A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-white/35 mt-0.5">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-white/[0.07] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.08]">
              <Upload className="h-5 w-5 text-white/30" />
            </div>
            <p className="text-sm font-medium text-white/60">
              Drag & drop a PDF here
            </p>
            <p className="mt-1 text-xs text-white/25">
              or{" "}
              <span className="text-[#009B3A] underline underline-offset-2">
                browse files
              </span>
            </p>
            {dragging && (
              <p className="mt-2 text-xs font-semibold text-[#009B3A] animate-pulse">
                Release to upload
              </p>
            )}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
            Document Type
          </label>
          <select
            className={selectCls}
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {DOC_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1.5">
            Court
          </label>
          <select
            className={selectCls}
            value={court}
            onChange={(e) => setCourt(e.target.value)}
          >
            {COURTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="mb-4 rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-[#009B3A]" />
            <p className="text-sm font-semibold text-[#009B3A]">
              Upload successful
            </p>
          </div>
          <p className="text-xs text-white/50 mt-1">{result.message}</p>
          {result.extracted > 0 && (
            <p className="text-xs text-white/70 mt-1">
              <span className="font-bold text-[#009B3A]">
                {result.extracted}
              </span>{" "}
              {result.extracted === 1 ? "record" : "records"} extracted
            </p>
          )}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#009B3A] py-3 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload & Process
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[11px] text-white/20">
        PDF will be parsed using the existing OCR pipeline. Extracted records
        are upserted into the database.
      </p>
    </div>
  );
}
