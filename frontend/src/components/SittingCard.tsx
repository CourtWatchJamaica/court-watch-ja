"use client";

import { CourtSitting } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Building2, Clock, ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import HighlightedSnippet from "@/components/HighlightedSnippet";

interface SittingCardProps {
  sitting: CourtSitting;
  onClick?: () => void;
  isTracked?: boolean;
  onTrack?: (id: number) => void;
}

function formatSittingTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatSittingDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-JM", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SittingCard({ sitting, onClick, isTracked, onTrack }: SittingCardProps) {
  const isParish = sitting._source === "parish";
  const accentHex = isParish ? "#CD7F32" : "#FED100";
  const accentRgb = isParish ? "205,127,50" : "254,209,0";

  return (
    <Card
      className={[
        "group relative bg-[#0d0d1a] border-l-2 border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06] cursor-pointer overflow-hidden transition-all duration-300",
        isParish
          ? "border-l-[#CD7F32]/50 hover:border-l-[#CD7F32] hover:bg-[#CD7F32]/[0.03]"
          : "border-l-[#FED100]/50 hover:border-l-[#FED100] hover:bg-[#FED100]/[0.03]",
      ].join(" ")}
      style={{ ["--hover-shadow" as string]: `0 4px 24px rgba(${accentRgb},0.12)` }}
      onClick={onClick}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br via-transparent to-transparent"
        style={{ backgroundImage: `linear-gradient(to bottom right, ${accentHex}0a, transparent, transparent)` }}
      />

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white/85 text-[13px] leading-snug group-hover:text-white transition-colors line-clamp-2">
              {sitting.title || sitting.case_number || "Untitled Sitting"}
            </h3>
            {sitting.case_number && sitting.title && (
              <p
                className="mt-1 text-[10px] font-mono break-all whitespace-normal"
                style={{ color: `${accentHex}80` }}
              >
                {sitting.case_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sitting.event_type && (
              <Badge
                className="text-[10px] font-medium px-1.5 py-0 h-5 rounded-md whitespace-nowrap border"
                style={{
                  backgroundColor: `${accentHex}1a`,
                  color: accentHex,
                  borderColor: `${accentHex}40`,
                }}
              >
                {sitting.event_type}
              </Badge>
            )}
            {onTrack && (
              isTracked ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(sitting.id); }}
                  className="flex items-center gap-1 rounded-md bg-[#FED100]/10 border border-[#FED100]/25 px-1.5 h-5 text-[9px] font-semibold text-[#FED100] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors"
                  aria-label="Untrack sitting"
                  title="Click to untrack"
                >
                  <BookmarkCheck className="h-2.5 w-2.5" />
                  Tracked
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(sitting.id); }}
                  className="flex items-center justify-center rounded-md h-5 w-5 text-white/20 hover:text-[#FED100] hover:bg-[#FED100]/10 transition-colors"
                  aria-label="Track sitting"
                >
                  <Bookmark className="h-3 w-3" />
                </button>
              )
            )}
            <ArrowUpRight
              className="h-3.5 w-3.5 text-white/20 transition-colors shrink-0 group-hover:opacity-60"
              style={{ ["--tw-text-opacity" as string]: "1" }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 space-y-0">
        <div className="space-y-1.5 mb-0">
          {sitting.judge_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <User className="h-3 w-3 text-white/25 shrink-0" />
              <span className="truncate">{sitting.judge_name}</span>
            </div>
          )}
          {sitting.court_division && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Building2 className="h-3 w-3 text-white/25 shrink-0" />
              <span className="truncate">{sitting.court_division}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {sitting.event_date && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <Calendar className="h-3 w-3 text-white/25 shrink-0" />
                <span>{formatSittingDate(sitting.event_date)}</span>
              </div>
            )}
            {sitting.event_time && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <Clock className="h-3 w-3 text-white/25 shrink-0" />
                <span>{formatSittingTime(sitting.event_time)}</span>
              </div>
            )}
          </div>
        </div>
        {sitting.snippet && (
          <>
            <div className="h-px bg-white/[0.05] my-3" />
            <HighlightedSnippet
              text={sitting.snippet}
              className="text-[11px] text-white/35 line-clamp-3 leading-relaxed"
              markClassName="bg-[#FED100]/20 text-[#FED100] rounded px-0.5 not-italic font-medium"
            />
          </>
        )}
      </CardContent>

      <div
        className="absolute bottom-0 left-0 h-[1.5px] w-0 group-hover:w-full transition-all duration-500 ease-out"
        style={{ backgroundImage: `linear-gradient(to right, ${accentHex}, ${accentHex}99, transparent)` }}
      />
    </Card>
  );
}
