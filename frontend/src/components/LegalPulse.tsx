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

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3.5 px-4 py-3.5 animate-pulse">
      <div className="mt-1 w-[3px] h-8 shrink-0 rounded-full bg-[#FED100]/20" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-2.5 w-12 rounded bg-muted/60" />
          <div className="h-2.5 w-20 rounded-full bg-muted/40" />
        </div>
      </div>
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
    <section>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-[3px] rounded-full bg-[#FED100]" />
          <NewspaperIcon className="h-3.5 w-3.5 text-[#FED100]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FED100]">
            Legal Pulse
          </span>
        </div>
        {!loading && news.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50">
            {news.length} article{news.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : error || news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
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
                className="group flex items-start gap-3.5 px-4 py-3.5 cursor-pointer hover:bg-accent/30 transition-colors"
              >
                {/* Gold left bar */}
                <div className="mt-1 h-full w-[3px] shrink-0 self-stretch rounded-full bg-[#FED100]/40 group-hover:bg-[#FED100]/70 transition-colors" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground/90 font-medium leading-snug line-clamp-2 group-hover:text-foreground transition-colors">
                    {item.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {date && (
                      <span className="text-[10px] text-muted-foreground">
                        {date}
                      </span>
                    )}
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      {item.source}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>

                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-1" />
              </a>
            );
          })
        )}
      </div>
    </section>
  );
}
