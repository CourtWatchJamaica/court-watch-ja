"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiClient } from "./api";

interface TrackingContextValue {
  judgmentIds: Set<number>;
  sittingIds: Set<number>;
  isTracked: (id: number, type: "judgment" | "sitting") => boolean;
  track: (id: number, type: "judgment" | "sitting") => Promise<void>;
  untrack: (id: number) => Promise<void>;
  toast: string | null;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [judgmentIds, setJudgmentIds] = useState<Set<number>>(new Set());
  const [sittingIds, setSittingIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiClient.getUserCases().then(({ cases }) => {
      const jIds = new Set<number>();
      const sIds = new Set<number>();
      for (const c of cases) {
        if (c.case_id == null) continue; // case_number-only entries have no ID yet
        if (c.case_type === "sitting") sIds.add(c.case_id);
        else jIds.add(c.case_id);
      }
      setJudgmentIds(jIds);
      setSittingIds(sIds);
    }).catch(() => {/* ignore — user may not be logged in yet */});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const isTracked = useCallback(
    (id: number, type: "judgment" | "sitting") => {
      return type === "sitting" ? sittingIds.has(id) : judgmentIds.has(id);
    },
    [judgmentIds, sittingIds],
  );

  const track = useCallback(
    async (id: number, type: "judgment" | "sitting") => {
      // Optimistic update
      if (type === "sitting") {
        setSittingIds((prev) => new Set(prev).add(id));
      } else {
        setJudgmentIds((prev) => new Set(prev).add(id));
      }
      showToast("Case tracked — view in Your Docket.");
      try {
        await apiClient.addUserCase(id, type);
      } catch {
        // Roll back
        if (type === "sitting") {
          setSittingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        } else {
          setJudgmentIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        }
        showToast("Failed to track case. Please try again.");
      }
    },
    [showToast],
  );

  const untrack = useCallback(
    async (id: number) => {
      // Determine type from current state — needs both sets so both are in deps.
      const isSitting = sittingIds.has(id);
      const caseType = isSitting ? "sitting" : "judgment";
      // Optimistic remove
      if (isSitting) {
        setSittingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      } else {
        setJudgmentIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
      try {
        await apiClient.removeUserCase(id, caseType);
      } catch {
        // Roll back on error
        if (isSitting) {
          setSittingIds((prev) => new Set(prev).add(id));
        } else {
          setJudgmentIds((prev) => new Set(prev).add(id));
        }
      }
    },
    [sittingIds, judgmentIds],
  );

  return (
    <TrackingContext.Provider
      value={{ judgmentIds, sittingIds, isTracked, track, untrack, toast }}
    >
      {children}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-3 shadow-2xl">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#009B3A]" />
            <p className="text-sm text-white/90">{toast}</p>
          </div>
        </div>
      )}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error("useTracking must be used inside TrackingProvider");
  return ctx;
}
