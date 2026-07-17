"use client";

import { formatDateOnly } from "@/lib/dates";
import { Judgment } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, User, Building2, ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import HighlightedSnippet from "@/components/HighlightedSnippet";

interface CaseCardProps {
  judgment: Judgment;
  onClick?: () => void;
  isTracked?: boolean;
  onTrack?: (id: number) => void;
}

export default function CaseCard({ judgment, onClick, isTracked, onTrack }: CaseCardProps) {
  return (
    <Card
      className="group relative bg-card border border-border cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_8px_40px_rgba(0,196,74,0.07),0_2px_12px_rgba(0,0,0,0.5)]"
      onClick={onClick}
    >
      {/* Ghost case number watermark */}
      <span
        aria-hidden
        className="pointer-events-none select-none absolute -right-3 top-1 font-mono font-bold leading-none text-foreground/[0.032] overflow-hidden"
        style={{ fontSize: "4.5rem", maxWidth: "190px", display: "block", whiteSpace: "nowrap", textOverflow: "clip" }}
      >
        {judgment.case_number}
      </span>

      {/* Ambient hover glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" />

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-foreground/80 text-[13px] leading-snug group-hover:text-foreground transition-colors line-clamp-2 flex-1">
            {judgment.title || judgment.case_number}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <span className="font-mono text-[10px] text-primary/70 bg-primary/[0.08] border border-primary/[0.18] px-1.5 py-0.5 rounded-md break-all whitespace-normal leading-tight min-w-0">
              {judgment.case_number}
            </span>
            {onTrack && (
              isTracked ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(judgment.id); }}
                  className="flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-1.5 h-5 text-[9px] font-semibold text-primary hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors"
                  aria-label="Untrack case"
                  title="Click to untrack"
                >
                  <BookmarkCheck className="h-2.5 w-2.5" />
                  Tracked
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(judgment.id); }}
                  className="flex items-center justify-center rounded-md h-5 w-5 text-foreground/20 hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Track case"
                >
                  <Bookmark className="h-3 w-3" />
                </button>
              )
            )}
            <ArrowUpRight className="h-3.5 w-3.5 text-foreground/[0.18] group-hover:text-primary/55 transition-colors duration-200 shrink-0" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-1.5 mb-3">
          {judgment.judge_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <User className="h-3 w-3 text-foreground/20 shrink-0" />
              <span className="truncate">{judgment.judge_name}</span>
            </div>
          )}
          {judgment.court && (
            <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <Building2 className="h-3 w-3 text-foreground/20 shrink-0" />
              <span className="truncate">{judgment.court}</span>
            </div>
          )}
          {judgment.date && (
            <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <Calendar className="h-3 w-3 text-foreground/20 shrink-0" />
              <span>
                {formatDateOnly(judgment.date, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {(judgment.snippet || judgment.summary_text) && (
          <>
            <div className="h-px bg-foreground/[0.05] mb-3" />
            {judgment.snippet ? (
              <HighlightedSnippet
                text={judgment.snippet}
                className="text-[11px] text-foreground/30 line-clamp-3 leading-relaxed"
              />
            ) : (
              <p className="text-[11px] text-foreground/30 line-clamp-2 leading-relaxed">
                {judgment.summary_text}
              </p>
            )}
          </>
        )}
      </CardContent>

      {/* Bottom glow line on hover */}
      <div className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-primary via-primary/45 to-transparent" />
    </Card>
  );
}
