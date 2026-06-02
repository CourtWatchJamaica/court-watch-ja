"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search…",
  initialValue = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="relative group">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/20 transition-colors group-focus-within:text-primary" />
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-10 text-[14px] text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/[0.12] transition-all duration-200"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-foreground/25 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-all"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
