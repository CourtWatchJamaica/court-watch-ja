"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Building2, Calendar, ArrowRight, Scale, Bookmark, BookmarkCheck } from "lucide-react";
import { formatDateOnly } from "@/lib/dates";
import { Judgment } from "@/lib/types";
import { useTracking } from "@/lib/tracking-context";

interface JudgmentCarouselProps {
  judgments: Judgment[];
}

const SLIDE_INTERVAL = 5000;

function CarouselCard({ judgment }: { judgment: Judgment }) {
  const router = useRouter();
  const { isTracked, track } = useTracking();
  const tracked = isTracked(judgment.id, "judgment");

  return (
    <div
      className="group relative h-full w-full rounded-2xl border border-white/[0.07] bg-[#0d0d1a] cursor-pointer overflow-hidden p-5 flex flex-col justify-between transition-colors duration-200 hover:border-[#009B3A]/30"
      onClick={() => router.push(`/cases/${judgment.id}`)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_left,rgba(0,155,58,0.08),transparent_60%)]" />

      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-[#009B3A]/12 border border-[#009B3A]/20 px-2.5 py-1">
          <Scale className="h-3 w-3 text-[#009B3A]" />
          <span className="text-[10px] font-semibold text-[#009B3A] whitespace-nowrap">
            {judgment.court ?? "Supreme Court"}
          </span>
        </div>
        {judgment.date && (
          <div className="flex items-center gap-1 shrink-0">
            <Calendar className="h-3 w-3 text-white/55" />
            <span className="text-[10px] text-white/65">
              {formatDateOnly(judgment.date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-3 flex-1">
        <h3 className="text-[15px] font-semibold text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {judgment.title || judgment.case_number}
        </h3>
        {judgment.case_number && judgment.title && (
          <p className="mt-1 font-mono text-[10px] text-white/60 tracking-wide">
            {judgment.case_number}
          </p>
        )}
      </div>

      {/* Bottom row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {judgment.judge_name ? (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-white/55 shrink-0" />
            <span className="text-[11px] text-white/70 truncate max-w-[140px]">
              {judgment.judge_name}
            </span>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2 shrink-0">
          {tracked ? (
            <span
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-[#009B3A]/15 border border-[#009B3A]/25 px-2 py-0.5 text-[9px] font-semibold text-[#009B3A]"
            >
              <BookmarkCheck className="h-2.5 w-2.5" />
              Tracked
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); track(judgment.id, "judgment"); }}
              className="flex items-center gap-1 rounded-full border border-white/[0.12] px-2 py-0.5 text-[9px] font-semibold text-white/70 hover:border-[#009B3A]/40 hover:text-[#009B3A] hover:bg-[#009B3A]/10 transition-colors"
            >
              <Bookmark className="h-2.5 w-2.5" />
              Track
            </button>
          )}
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#009B3A]/70 group-hover:text-[#009B3A] transition-colors">
            Read case
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[1.5px] w-0 group-hover:w-full transition-all duration-500 ease-out bg-gradient-to-r from-[#009B3A] via-[#009B3A]/60 to-transparent" />
    </div>
  );
}

export default function JudgmentCarousel({ judgments }: JudgmentCarouselProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = judgments.length;
  const MAX_DOTS = 5;

  // Use scrollTo on the container instead of scrollIntoView to prevent
  // the browser from scrolling the page when the carousel auto-advances.
  const scrollToIndex = useCallback(
    (index: number) => {
      if (!scrollRef.current || index < 0 || index >= total) return;
      const container = scrollRef.current;
      const el = container.children[index] as HTMLElement | undefined;
      if (!el) return;
      container.scrollTo({ left: el.offsetLeft, behavior: "smooth" });
      setActiveIndex(index);
      setProgressKey((k) => k + 1);
    },
    [total],
  );

  // Pause auto-advance when the browser tab loses visibility.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || total <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % total;
        scrollToIndex(next);
        return next;
      });
    }, SLIDE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, total, scrollToIndex]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Array.from(container.children).indexOf(entry.target);
            if (idx !== -1) {
              setActiveIndex(idx);
              setProgressKey((k) => k + 1);
            }
          }
        }
      },
      { root: container, threshold: 0.5 },
    );

    Array.from(container.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [judgments]);

  if (total === 0) return null;

  const dotsVisible = Math.min(total, MAX_DOTS);
  const extraCount = total > MAX_DOTS ? total - MAX_DOTS : 0;

  return (
    <section
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => {
        setTimeout(() => setPaused(false), 800);
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#009B3A]" />
          <h2 className="text-sm font-semibold text-foreground tracking-wide">
            Latest Judgments
          </h2>
        </div>
        <button
          onClick={() => router.push("/cases")}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          See all judgments
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl">
        <button
          onClick={() => scrollToIndex((activeIndex - 1 + total) % total)}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0d0d1a]/80 border border-white/[0.1] text-white/50 opacity-0 hover:opacity-100 hover:text-white hover:bg-[#0d0d1a] transition-all duration-200 focus:opacity-100 md:group-hover:opacity-100 carousel-arrow"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => scrollToIndex((activeIndex + 1) % total)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0d0d1a]/80 border border-white/[0.1] text-white/50 opacity-0 hover:opacity-100 hover:text-white hover:bg-[#0d0d1a] transition-all duration-200 focus:opacity-100 md:group-hover:opacity-100 carousel-arrow"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* overscroll-x-contain stops horizontal swipe from propagating to the page */}
        <div
          ref={scrollRef}
          className="flex overflow-x-scroll gap-3 px-4 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain"
          style={{ scrollBehavior: "smooth" }}
        >
          {judgments.map((judgment) => (
            <div
              key={judgment.id}
              className="flex-none w-[calc(100%-2rem)] [scroll-snap-align:center] h-[168px] sm:h-[200px]"
            >
              <CarouselCard judgment={judgment} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          {!paused && (
            <div
              key={progressKey}
              className="h-full bg-[#009B3A] carousel-progress-bar"
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: dotsVisible }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === (activeIndex < MAX_DOTS ? activeIndex : MAX_DOTS - 1)
                  ? "h-2 w-4 bg-[#009B3A]"
                  : "h-1.5 w-1.5 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
          {extraCount > 0 && (
            <span className="text-[10px] text-white/55 ml-0.5">+{extraCount}</span>
          )}
        </div>
      </div>
    </section>
  );
}
