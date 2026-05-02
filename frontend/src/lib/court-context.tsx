"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type Court = "Supreme Court" | "Court of Appeal" | "Parish Court";

export const COURTS: Court[] = [
  "Supreme Court",
  "Court of Appeal",
  "Parish Court",
];

interface CourtContextValue {
  selectedCourt: Court;
  setSelectedCourt: (court: Court) => void;
  isRefreshing: boolean;
}

const CourtContext = createContext<CourtContextValue>({
  selectedCourt: "Supreme Court",
  setSelectedCourt: () => {},
  isRefreshing: false,
});

export function CourtProvider({ children }: { children: ReactNode }) {
  const [selectedCourt, setSelectedCourtState] = useState<Court>("Supreme Court");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cwja_court") as Court | null;
      if (stored && (COURTS as string[]).includes(stored)) {
        setSelectedCourtState(stored);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const setSelectedCourt = useCallback((court: Court) => {
    setSelectedCourtState(court);
    try {
      localStorage.setItem("cwja_court", court);
    } catch {}
    setIsRefreshing(true);
    const t = setTimeout(() => setIsRefreshing(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <CourtContext.Provider value={{ selectedCourt, setSelectedCourt, isRefreshing }}>
      {children}
    </CourtContext.Provider>
  );
}

export const useCourt = () => useContext(CourtContext);
