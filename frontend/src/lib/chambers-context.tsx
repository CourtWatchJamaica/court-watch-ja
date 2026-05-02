"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ChambersContextValue {
  isOpen: boolean;
  openChambers: () => void;
  closeChambers: () => void;
}

const ChambersContext = createContext<ChambersContextValue>({
  isOpen: false,
  openChambers: () => {},
  closeChambers: () => {},
});

export function ChambersProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ChambersContext.Provider
      value={{
        isOpen,
        openChambers: () => setIsOpen(true),
        closeChambers: () => setIsOpen(false),
      }}
    >
      {children}
    </ChambersContext.Provider>
  );
}

export const useChambers = () => useContext(ChambersContext);
