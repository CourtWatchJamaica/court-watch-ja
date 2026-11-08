"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { NewspaperIcon } from "@/components/icons";
import { apiClient } from "@/lib/api";
import { LegalNewsItem } from "@/lib/types";

function categoryMeta(cat: string): { label: string; color: string } {
  if (cat === "judgment")
    return { label: "Court", color: "bg-[#009B3A]/15 text-[#009B3A]" };
  return { label: "Crime", color: "bg-red-500/15 text-red-400" };
}

function formatDate(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-JM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SkeletonTile() {
  return (
    <div className="aspect-square rounded-3xl glass-panel p-4 flex flex-col justify-between animate-pulse">
      <div className="h-4 w-16 rounded-full bg-[#FED100]/20" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <div className="h-2.5 w-20 rounded-full bg-muted/60" />
    </div>
  );
}

export default function LegalPulse() {
  const [news, setNews] = useState<LegalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { news: items } = await apiClient.getLegalNews({ limit: 8 });
      setNews(items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    // Always-dark grey glass panel (the "dark" class switches the theme colours inside it).
    <section className="dark dark-glass-section">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-[3px] rounded-full bg-[#FED100]" />
          <NewspaperIcon className="h-3.5 w-3.5 text-[#FED100]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FED100]">
            Legal Pulse
          </span>
        </div>
        {!loading && news.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
 article{news.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Body: grid of square article cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)
        ) : error || news.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-3xl glass-panel py-10 text-center px-6">
            <NewspaperIcon className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground/50">
              {error ? "Could not load news" : "No news articles yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/35">
              {error
                ? "News feeds will be retried on the next scraper run."
                : "Legal Pulse pulls from Jamaican news feeds daily."}
            </p>
          </div>
        ) : (
          news.map((item) => {
            const meta = categoryMeta(item.category);
            const date = formatDate(item.published_at ?? item.created_at);
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-3xl glass-panel p-3.5 sm:p-4 flex flex-col cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FED100]/40"
              >
                {/* Gold glow in the corner */}
                <div className="pointer-events-none absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity [background:radial-gradient(80%_60%_at_100%_0%,rgba(254,209,0,0.10),transparent_70%)]" aria-hidden="true" />

                {/* Category + link icon */}
                <div className="relative flex items-start justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </div>

                {/* Headline */}
                <p className="relative mt-2.5 sm:mt-3 text-[12px] sm:text-[14px] lg:text-[16px] font-bold tracking-[-0.01em] text-foreground/90 leading-snug line-clamp-3 sm:line-clamp-4 group-hover:text-foreground transition-colors">
                  {item.title}
                </p>

                {/* Source + date */}
                <div className="relative mt-auto pt-2 sm:pt-3 flex flex-col gap-0.5 sm:gap-1">
                  <span className="truncate text-[10px] font-medium text-muted-foreground">
                    {item.source}
                  </span>
                  {date && (
                    <span className="text-[10px] text-muted-foreground/70">{date}</span>
                  )}
                </div>
              </a>
            );
          })
        )}
      </div>
    </section>
  );
}
