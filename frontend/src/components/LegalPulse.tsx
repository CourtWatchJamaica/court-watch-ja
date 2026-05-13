"use client";

import { ArrowRight } from "lucide-react";
import { NewspaperIcon } from "@/components/icons";

const NEWS_ITEMS = [
  {
    date: "May 1, 2026",
    headline:
      "Court of Appeal upholds landmark property rights ruling in Kingston commercial dispute",
    source: "Jamaica Gleaner",
  },
  {
    date: "Apr 30, 2026",
    headline:
      "New parish court filing procedures take effect across all 14 parishes in June",
    source: "RJR News",
  },
  {
    date: "Apr 28, 2026",
    headline:
      "Chief Justice addresses mounting case backlog at annual judicial leadership forum",
    source: "Loop Jamaica",
  },
  {
    date: "Apr 25, 2026",
    headline:
      "Supreme Court issues updated practice directions for commercial division disputes",
    source: "Jamaica Observer",
  },
];

export default function LegalPulse() {
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
        <button className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-[#FED100]/70 dark:hover:text-[#FED100] transition-colors">
          See all news
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* News items */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
        {NEWS_ITEMS.map((item, i) => (
          <div
            key={i}
            className="group flex items-start gap-3.5 px-4 py-3.5 cursor-pointer hover:bg-accent/30 transition-colors"
          >
            {/* Gold left bar */}
            <div className="mt-1 h-full w-[3px] shrink-0 self-stretch rounded-full bg-[#FED100]/40 group-hover:bg-[#FED100]/70 transition-colors" />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-foreground/90 font-medium leading-snug line-clamp-2 group-hover:text-foreground transition-colors">
                {item.headline}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{item.date}</span>
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {item.source}
                </span>
              </div>
            </div>

            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
          </div>
        ))}
      </div>
    </section>
  );
}
