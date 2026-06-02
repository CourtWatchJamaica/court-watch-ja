"use client";

import { CourtSitting } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  const accentHex = isParish ? "#cd9060" : "#f0c040";
  const glowRgba = isParish ? "rgba(205,144,96,0.07)" : "rgba(240,192,64,0.07)";
  const borderHover = isParish ? "rgba(205,144,96,0.2)" : "rgba(240,192,64,0.2)";

  return (
    <Card
      className="group relative bg-card cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        border: "1px solid var(--border)",
        transition: "transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = borderHover;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 40px ${glowRgba}, 0 2px 12px rgba(0,0,0,0.5)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
      onClick={onClick}
    >

      {/* Ghost case number watermark */}
      {(sitting.case_number || sitting.title) && (
        <span
          aria-hidden
          className="pointer-events-none select-none absolute -right-3 top-1 font-mono font-bold leading-none text-foreground/[0.032] overflow-hidden"
          style={{ fontSize: "4.5rem", maxWidth: "190px", display: "block", whiteSpace: "nowrap", textOverflow: "clip" }}
        >
          {sitting.case_number ?? sitting.title?.slice(0, 12)}
        </span>
      )}

      {/* Ambient hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 bg-gradient-to-br via-transparent to-transparent"
        style={{ backgroundImage: `linear-gradient(to bottom right, ${accentHex}07, transparent, transparent)` }}
      />

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground/80 text-[13px] leading-snug group-hover:text-foreground transition-colors line-clamp-2">
              {sitting.title || sitting.case_number || "Untitled Sitting"}
            </h3>
            {sitting.case_number && sitting.title && (
              <p className="mt-1 text-[10px] font-mono break-all whitespace-normal" style={{ color: `${accentHex}99` }}>
                {sitting.case_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sitting.event_type && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap border"
                style={{
                  backgroundColor: `${accentHex}14`,
                  color: accentHex,
                  borderColor: `${accentHex}35`,
                }}
              >
                {sitting.event_type}
              </span>
            )}
            {onTrack && (
              isTracked ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(sitting.id); }}
                  className="flex items-center gap-1 rounded-md border px-1.5 h-5 text-[9px] font-semibold hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors"
                  style={{ backgroundColor: `${accentHex}14`, borderColor: `${accentHex}30`, color: accentHex }}
                  aria-label="Untrack sitting"
                >
                  <BookmarkCheck className="h-2.5 w-2.5" />
                  Tracked
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrack(sitting.id); }}
                  className="flex items-center justify-center rounded-md h-5 w-5 text-foreground/20 transition-colors hover:bg-foreground/[0.06]"
                  aria-label="Track sitting"
                >
                  <Bookmark className="h-3 w-3" />
                </button>
              )
            )}
            <ArrowUpRight className="h-3.5 w-3.5 text-foreground/[0.18] group-hover:opacity-60 transition-all shrink-0" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-1.5">
          {sitting.judge_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <User className="h-3 w-3 text-foreground/20 shrink-0" />
              <span className="truncate">{sitting.judge_name}</span>
            </div>
          )}
          {sitting.court_division && (
            <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
              <Building2 className="h-3 w-3 text-foreground/20 shrink-0" />
              <span className="truncate">{sitting.court_division}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {sitting.event_date && (
              <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
                <Calendar className="h-3 w-3 text-foreground/20 shrink-0" />
                <span>{formatSittingDate(sitting.event_date)}</span>
              </div>
            )}
            {sitting.event_time && (
              <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
                <Clock className="h-3 w-3 text-foreground/20 shrink-0" />
                <span>{formatSittingTime(sitting.event_time)}</span>
              </div>
            )}
          </div>
        </div>
        {sitting.snippet && (
          <>
            <div className="h-px bg-foreground/[0.05] my-3" />
            <HighlightedSnippet
              text={sitting.snippet}
              className="text-[11px] text-foreground/30 line-clamp-3 leading-relaxed"
              markClassName="bg-[rgba(240,192,64,0.15)] text-[#f0c040] rounded px-0.5 not-italic font-medium"
            />
          </>
        )}
      </CardContent>

      {/* Bottom glow line on hover */}
      <div
        className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500 ease-out"
        style={{ backgroundImage: `linear-gradient(to right, ${accentHex}, ${accentHex}66, transparent)` }}
      />
    </Card>
  );
}
