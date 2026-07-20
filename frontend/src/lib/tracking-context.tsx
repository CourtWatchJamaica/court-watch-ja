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

type TrackType = "judgment" | "sitting" | "parish_court";

interface TrackingContextValue {
  judgmentIds: Set<number>;
  sittingIds: Set<number>;
  parishCourtIds: Set<number>;
  isTracked: (id: number, type: TrackType) => boolean;
  track: (id: number, type: TrackType) => Promise<void>;
  untrack: (id: number) => Promise<void>;
  toast: string | null;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

// Maps a track type to its state setter, so track/untrack don't need a
// per-type branch for every set.
function setterFor(
  type: TrackType,
  setJudgmentIds: React.Dispatch<React.SetStateAction<Set<number>>>,
  setSittingIds: React.Dispatch<React.SetStateAction<Set<number>>>,
  setParishCourtIds: React.Dispatch<React.SetStateAction<Set<number>>>,
) {
  if (type === "sitting") return setSittingIds;
  if (type === "parish_court") return setParishCourtIds;
  return setJudgmentIds;
}

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [judgmentIds, setJudgmentIds] = useState<Set<number>>(new Set());
  const [sittingIds, setSittingIds] = useState<Set<number>>(new Set());
  const [parishCourtIds, setParishCourtIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiClient.getUserCases().then(({ cases }) => {
      const jIds = new Set<number>();
      const sIds = new Set<number>();
      const pIds = new Set<number>();
      for (const c of cases) {
        if (c.case_id == null) continue; // case_number-only entries have no ID yet
        if (c.case_type === "sitting") sIds.add(c.case_id);
        else if (c.case_type === "parish_court") pIds.add(c.case_id);
        else jIds.add(c.case_id);
      }
      setJudgmentIds(jIds);
      setSittingIds(sIds);
      setParishCourtIds(pIds);
    }).catch(() => {/* ignore — user may not be logged in yet */});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const isTracked = useCallback(
    (id: number, type: TrackType) => {
      if (type === "sitting") return sittingIds.has(id);
      if (type === "parish_court") return parishCourtIds.has(id);
      return judgmentIds.has(id);
    },
    [judgmentIds, sittingIds, parishCourtIds],
  );

  const track = useCallback(
    async (id: number, type: TrackType) => {
      const setIds = setterFor(type, setJudgmentIds, setSittingIds, setParishCourtIds);
      // Optimistic update
      setIds((prev) => new Set(prev).add(id));
      showToast(
        type === "parish_court"
          ? "Case tracked — you'll be notified when its status changes."
          : "Case tracked — view in Your Docket.",
      );
      try {
        await apiClient.addUserCase(id, type);
      } catch {
        setIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        showToast("Failed to track case. Please try again.");
      }
    },
    [showToast],
  );

  const untrack = useCallback(
    async (id: number) => {
      // Determine type from current state — needs all sets so all are in deps.
      const type: TrackType = sittingIds.has(id)
        ? "sitting"
        : parishCourtIds.has(id)
        ? "parish_court"
        : "judgment";
      const setIds = setterFor(type, setJudgmentIds, setSittingIds, setParishCourtIds);
      // Optimistic remove
      setIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      try {
        await apiClient.removeUserCase(id, type);
      } catch {
        // Roll back on error
        setIds((prev) => new Set(prev).add(id));
      }
    },
    [sittingIds, parishCourtIds],
  );

  return (
    <TrackingContext.Provider
      value={{ judgmentIds, sittingIds, parishCourtIds, isTracked, track, untrack, toast }}
    >
      {children}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#009B3A]/30 bg-[#0e0e1a] px-4 py-3 shadow-2xl">
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
