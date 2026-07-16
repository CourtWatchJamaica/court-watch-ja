"use client";

import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  confirmClassName = "bg-red-500 hover:bg-red-600",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#0d0d1a] p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 rounded-xl bg-red-500/15 p-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="min-h-[44px] rounded-xl px-4 text-sm text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-[44px] rounded-xl px-5 text-sm font-semibold text-white transition-colors ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
