"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  resourceName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  resourceName: string;
}) {
  const [value, setValue] = useState("");

  if (!isOpen) return null;

  const confirmed = value === "DELETE";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#0d0d1a] p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 rounded-xl bg-red-500/15 p-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Confirm deletion</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              This will permanently remove{" "}
              <span className="font-mono text-white/70">{resourceName}</span>. This cannot
              be undone.
            </p>
          </div>
          <button
            onClick={() => { setValue(""); onClose(); }}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-2 text-xs text-white/70">
          Type <span className="font-mono font-semibold text-white/60">DELETE</span> to confirm:
        </p>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && confirmed) { setValue(""); onConfirm(); } }}
          placeholder="DELETE"
          className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/50 focus:border-red-500/40 focus:outline-none transition-colors mb-4"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setValue(""); onClose(); }}
            className="min-h-[44px] rounded-xl px-4 text-sm text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { setValue(""); onConfirm(); }}
            disabled={!confirmed}
            className="min-h-[44px] rounded-xl px-5 text-sm font-semibold text-white transition-colors bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
