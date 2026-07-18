"use client";

import { useState } from "react";
import { Search, Calendar, Bookmark, Users, ArrowRight, X } from "lucide-react";
import { apiClient } from "@/lib/api";

const STEPS = [
  {
    icon: Search,
    iconBg: "bg-[#009B3A]/15",
    iconColor: "text-[#009B3A]",
    title: "Search Judgments",
    body: "Browse thousands of Supreme Court and Court of Appeal judgments. Filter by court, judge, date range, or case number to find exactly what you need.",
  },
  {
    icon: Calendar,
    iconBg: "bg-[#FED100]/12",
    iconColor: "text-[#FED100]",
    title: "Browse Court Lists",
    body: "See what's scheduled in court today and this week. Upcoming hearings across all divisions are updated daily as new court lists are published.",
  },
  {
    icon: Bookmark,
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    title: "Track a Case",
    body: "Enter any case number to follow it. You'll be notified when a new judgment is filed, a hearing date changes, or your case is listed.",
  },
  {
    icon: Users,
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    title: "Explore Judges & Parish Analytics",
    body: "Discover judges' full case histories through the 3D constellation view, and explore Parish Court data across all 14 parishes island-wide.",
  },
];

interface WelcomeGuideProps {
  notificationId: number;
  onClose: () => void;
}

export default function WelcomeGuide({ notificationId, onClose }: WelcomeGuideProps) {
  const [step, setStep] = useState(0);

  const markRead = async () => {
    try {
      await apiClient.markNotificationRead(notificationId);
    } catch {
      // silently ignore
    }
  };

  const handleClose = async () => {
    await markRead();
    onClose();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleClose();
    }
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-sm rounded-lg border border-white/[0.08] bg-[#0e0e1a] shadow-2xl overflow-hidden">
        {/* Skip button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white/60 transition-colors"
          aria-label="Skip guide"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Step indicator strip */}
        <div className="flex h-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-colors duration-300 ${
                i <= step ? "bg-[#009B3A]" : "bg-white/[0.08]"
              } ${i > 0 ? "ml-0.5" : ""}`}
            />
          ))}
        </div>

        <div className="p-7">
          {/* Icon */}
          <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${current.iconBg}`}>
            <Icon className={`h-6 w-6 ${current.iconColor}`} />
          </div>

          {/* Step label */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60 mb-2">
            Step {step + 1} of {STEPS.length}
          </p>

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-3 leading-snug">
            {current.title}
          </h2>

          {/* Body */}
          <p className="text-sm text-white/55 leading-relaxed mb-8">
            {current.body}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="text-xs text-white/55 hover:text-white/70 transition-colors"
            >
              Skip guide
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 rounded-md bg-[#009B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#009B3A]/85 transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? "w-4 bg-[#009B3A]" : "w-1.5 bg-white/[0.15]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
