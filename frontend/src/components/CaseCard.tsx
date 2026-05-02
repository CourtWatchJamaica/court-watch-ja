"use client";

import { Judgment } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Building2, ArrowUpRight } from "lucide-react";

interface CaseCardProps {
  judgment: Judgment;
  onClick?: () => void;
}

export default function CaseCard({ judgment, onClick }: CaseCardProps) {
  return (
    <Card
      className="group relative bg-[#0d0d1a] border-l-2 border-l-[#009B3A]/50 border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06] cursor-pointer overflow-hidden transition-all duration-300 hover:border-l-[#009B3A] hover:bg-[#009B3A]/[0.04] hover:shadow-[0_4px_24px_rgba(0,155,58,0.12)]"
      onClick={onClick}
    >
      {/* Hover glow wash */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[#009B3A]/[0.05] via-transparent to-transparent" />

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-white/85 text-[13px] leading-snug group-hover:text-white transition-colors line-clamp-2 flex-1">
            {judgment.title || judgment.case_number}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className="bg-[#009B3A]/12 text-[#009B3A] border border-[#009B3A]/25 text-[10px] font-mono px-1.5 py-0 h-5 rounded-md">
              {judgment.case_number}
            </Badge>
            <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-[#009B3A]/60 transition-colors duration-200 shrink-0" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 space-y-0">
        <div className="space-y-1.5 mb-3">
          {judgment.judge_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <User className="h-3 w-3 text-white/25 shrink-0" />
              <span className="truncate">{judgment.judge_name}</span>
            </div>
          )}
          {judgment.court && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Building2 className="h-3 w-3 text-white/25 shrink-0" />
              <span className="truncate">{judgment.court}</span>
            </div>
          )}
          {judgment.date && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Calendar className="h-3 w-3 text-white/25 shrink-0" />
              <span>
                {new Date(judgment.date).toLocaleDateString("en-JM", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {judgment.summary_text && (
          <>
            <div className="h-px bg-white/[0.05] mb-3" />
            <p className="text-[11px] text-white/35 line-clamp-2 leading-relaxed">
              {judgment.summary_text}
            </p>
          </>
        )}
      </CardContent>

      {/* Bottom green sweep on hover */}
      <div className="absolute bottom-0 left-0 h-[1.5px] w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-[#009B3A] via-[#009B3A]/60 to-transparent" />
    </Card>
  );
}
