"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  X, Calendar, DollarSign, FileText, Scale,
  ChevronDown, RotateCcw, ExternalLink, AlertCircle, CheckCircle, Clock,
  Copy, CopyCheck,
} from "lucide-react";
import { useChambers } from "@/lib/chambers-context";
import { useTracking } from "@/lib/tracking-context";
import { apiClient } from "@/lib/api";
import type { CourtSitting } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ── Types ── */

type Tool = "deadline" | "paye" | "fees";

interface CprTask {
  id: string;
  label: string;
  days: number;
  direction: "before" | "after";
  dateLabel: string;
  description: string;
}

/* ── CPR Task Definitions ── */

const CPR_TASKS: CprTask[] = [
  {
    id: "list_docs",
    label: "File List of Documents",
    days: 42,
    direction: "before",
    dateLabel: "Hearing Date",
    description: "42 working days before hearing (CPR r. 29.7)",
  },
  {
    id: "witness_stmts",
    label: "Serve Witness Statements",
    days: 56,
    direction: "before",
    dateLabel: "Hearing Date",
    description: "56 working days before hearing (CPR r. 29.8)",
  },
  {
    id: "skeleton_args",
    label: "File Skeleton Arguments",
    days: 28,
    direction: "before",
    dateLabel: "Hearing Date",
    description: "28 working days before hearing (CPR r. 36.10)",
  },
  {
    id: "trial_bundle",
    label: "File Trial Bundle",
    days: 21,
    direction: "before",
    dateLabel: "Hearing Date",
    description: "21 working days before hearing (CPR r. 36.3)",
  },
  {
    id: "file_defence",
    label: "File Defence",
    days: 28,
    direction: "after",
    dateLabel: "Date of Service of Claim",
    description: "28 working days after service of claim (CPR r. 10.3)",
  },
  {
    id: "custom",
    label: "Custom Deadline",
    days: 0,
    direction: "before",
    dateLabel: "Reference Date",
    description: "Enter your own number of working days before a date",
  },
];

/* ── Court Fees Data ── */

const COURT_FEES_SECTIONS = [
  {
    section: "Filing Fees (Stamp Duty)",
    note: "Court filing fees are paid at the Stamp Office — not the court registry.",
    items: [
      { type: "Fixed Date Claim Form", fee: "$5,000" },
      { type: "Claim Form (general civil)", fee: "$5,000" },
      { type: "Divorce Petition", fee: "$5,000" },
      { type: "Counterclaim", fee: "$5,000" },
      { type: "Probate / Administration Application", fee: "$5,000" },
      { type: "Administrator-General flat fee", fee: "$5,000 – $25,000" },
      { type: "Originating Motion", fee: "$5,000" },
    ],
  },
  {
    section: "Appeal Fees",
    note: "Amount depends on case value. Verify at the Stamp Office.",
    items: [
      { type: "Application to Privy Council", fee: "$29,790 – $198,602" },
    ],
  },
  {
    section: "Property & Transaction Fees",
    note: "Legal fees attract GCT. Verify all amounts at the Stamp Office.",
    items: [
      { type: "Transfer Tax — real estate (seller pays)", fee: "2% of market value" },
      { type: "Stamp Duty on sale agreement", fee: "$5,000 flat (buyer & seller share)" },
      { type: "Legal fees — property sale", fee: "2–3% of purchase price + GCT" },
    ],
  },
];

/* ── Holiday Utilities ── */

function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function buildHolidaySet(year: number): Set<string> {
  const s = new Set<string>();
  const add = (d: Date) => s.add(dateToYMD(d));

  add(new Date(year, 0, 1));   // New Year's Day
  add(new Date(year, 4, 23));  // Labour Day
  add(new Date(year, 7, 1));   // Emancipation Day
  add(new Date(year, 7, 6));   // Independence Day
  add(new Date(year, 11, 25)); // Christmas Day
  add(new Date(year, 11, 26)); // Boxing Day

  const easter = easterSunday(year);
  const ashWed = new Date(easter); ashWed.setDate(easter.getDate() - 46);
  const goodFri = new Date(easter); goodFri.setDate(easter.getDate() - 2);
  const easterMon = new Date(easter); easterMon.setDate(easter.getDate() + 1);
  add(ashWed); add(goodFri); add(easterMon);

  // National Heroes Day: 3rd Monday of October
  const oct1 = new Date(year, 9, 1);
  const dow = oct1.getDay();
  const daysToFirstMon = dow === 1 ? 0 : (8 - dow) % 7;
  add(new Date(year, 9, 1 + daysToFirstMon + 14));

  return s;
}

const holidayCache = new Map<number, Set<string>>();
function isJamaicanHoliday(d: Date): boolean {
  const y = d.getFullYear();
  if (!holidayCache.has(y)) holidayCache.set(y, buildHolidaySet(y));
  return holidayCache.get(y)!.has(dateToYMD(d));
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/* ── Deadline Logic ── */

interface DeadlineResult {
  deadlineDate: Date;
  workingDaysFromToday: number;
  steps: string[];
  isPast: boolean;
  isUrgent: boolean;
}

function addWorkingDays(from: Date, days: number, dir: 1 | -1): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + dir);
    if (!isWeekend(result) && !isJamaicanHoliday(result)) remaining--;
  }
  return result;
}

function countWorkingDays(from: Date, to: Date): number {
  const past = to < from;
  const [start, end] = past ? [to, from] : [from, to];
  const cursor = new Date(start);
  let count = 0;
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor) && !isJamaicanHoliday(cursor)) count++;
  }
  return past ? -count : count;
}

function calcDeadline(
  refDate: string,
  task: CprTask,
  customDays: number,
): DeadlineResult | null {
  if (!refDate) return null;
  const days = task.id === "custom" ? customDays : task.days;
  if (days <= 0) return null;

  const ref = new Date(refDate + "T00:00:00");
  const dir: 1 | -1 = task.direction === "before" ? -1 : 1;
  const deadline = addWorkingDays(ref, days, dir);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const workingDiff = countWorkingDays(today, deadline);
  const isPast = deadline < today;
  const isUrgent = !isPast && workingDiff <= 5;

  const dirLabel = task.direction === "before" ? "before" : "after";
  const steps = [
    `Reference: ${ref.toLocaleDateString("en-JM", { day: "numeric", month: "long", year: "numeric" })}`,
    `Count ${days} working days ${dirLabel}, skipping weekends & public holidays`,
    `Deadline: ${deadline.toLocaleDateString("en-JM", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
  ];

  return { deadlineDate: deadline, workingDaysFromToday: workingDiff, steps, isPast, isUrgent };
}

/* ── PAYE 2025 ── */

interface PAYEResult {
  grossMonthly: number;
  nisMonthly: number;
  pensionMonthly: number;
  statutoryMonthly: number;
  edTaxMonthly: number;
  nhtMonthly: number;
  payeMonthly: number;
  netMonthly: number;
  belowThreshold: boolean;
  threshold: number;
}

function calcPAYE2025(
  grossMonthly: number,
  isOver65: boolean,
  pensionMonthly: number,
): PAYEResult {
  const annual = (x: number) => x * 12;
  const grossAnnual = annual(grossMonthly);
  const pensionAnnual = annual(pensionMonthly);

  // NIS: 3% of gross, ceiling at $5M gross → max $150,000/yr ($12,500/mo)
  const nisAnnual = Math.min(grossAnnual * 0.03, 150_000);

  const statutoryAnnual = Math.max(0, grossAnnual - nisAnnual - pensionAnnual);
  const edTaxAnnual = statutoryAnnual * 0.0225;
  const nhtAnnual = grossAnnual * 0.02;

  const threshold = isOver65 ? 1_799_376 + 250_040 : 1_799_376;
  const taxableAnnual = Math.max(0, statutoryAnnual - threshold);
  const belowThreshold = taxableAnnual === 0;

  let payeAnnual = 0;
  if (taxableAnnual > 0) {
    const band1Limit = 6_000_000 - threshold;
    payeAnnual =
      Math.min(taxableAnnual, band1Limit) * 0.25 +
      Math.max(0, taxableAnnual - band1Limit) * 0.3;
  }

  const netAnnual = grossAnnual - nisAnnual - pensionAnnual - edTaxAnnual - nhtAnnual - payeAnnual;

  return {
    grossMonthly,
    nisMonthly: nisAnnual / 12,
    pensionMonthly,
    statutoryMonthly: statutoryAnnual / 12,
    edTaxMonthly: edTaxAnnual / 12,
    nhtMonthly: nhtAnnual / 12,
    payeMonthly: payeAnnual / 12,
    netMonthly: netAnnual / 12,
    belowThreshold,
    threshold,
  };
}

/* ── Formatting ── */

const fmt = (n: number) =>
  "$" + Math.abs(n).toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Shared input styles (light + dark) ── */

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#009B3A]/60 focus:ring-1 focus:ring-[#009B3A]/30 " +
  "dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white dark:placeholder-white/25 [color-scheme:light] dark:[color-scheme:dark]";

const selectCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:border-[#009B3A]/60 focus:ring-1 focus:ring-[#009B3A]/30 " +
  "dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white [color-scheme:light] dark:[color-scheme:dark]";

const labelCls = "mb-1 block text-[10px] text-gray-500 dark:text-white/35";

/* ── Donut Chart ── */

function DonutChart({ data }: { data: PAYEResult }) {
  const slices = [
    { label: "Net Pay", value: data.netMonthly, color: "#009B3A" },
    { label: "PAYE", value: data.payeMonthly, color: "#FED100" },
    { label: "NIS", value: data.nisMonthly, color: "#3b82f6" },
    { label: "NHT", value: data.nhtMonthly, color: "#a855f7" },
    { label: "Ed. Tax", value: data.edTaxMonthly, color: "#f97316" },
    ...(data.pensionMonthly > 0
      ? [{ label: "Pension", value: data.pensionMonthly, color: "#ec4899" }]
      : []),
  ];
  let cum = 0;
  const gradient = slices
    .map(({ color, value }) => {
      const pct = (value / data.grossMonthly) * 100;
      const s = cum; cum += pct;
      return `${color} ${s.toFixed(2)}% ${cum.toFixed(2)}%`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <div className="h-full w-full rounded-full" style={{ background: `conic-gradient(${gradient})` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-gray-100 dark:bg-[#0d0d1a] flex items-center justify-center">
            <span className="text-[9px] font-semibold text-gray-400 dark:text-white/40 text-center leading-tight">
              Net<br />Pay
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1 flex-1">
        {slices.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-gray-500 dark:text-white/50">{label}</span>
            </div>
            <span className="text-[10px] font-mono text-gray-600 dark:text-white/60">{fmt(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tool: Court Deadline Calculator ── */

function DeadlineCalculator({ sittingIds }: { sittingIds: Set<number> }) {
  const todayStr = dateToYMD(new Date());
  const [taskId, setTaskId] = useState("list_docs");
  const [refDate, setRefDate] = useState("");
  const [customDays, setCustomDays] = useState(14);
  const [trackedSittings, setTrackedSittings] = useState<CourtSitting[]>([]);
  const [showTracked, setShowTracked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (sittingIds.size === 0) return;
    apiClient
      .getCourtSittings({ date_from: todayStr })
      .then(({ sittings }) =>
        setTrackedSittings(sittings.filter((s) => sittingIds.has(s.id) && !!s.event_date))
      )
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sittingIds.size]);

  const task = CPR_TASKS.find((t) => t.id === taskId)!;
  const result = useMemo(
    () => calcDeadline(refDate, task, customDays),
    [refDate, task, customDays],
  );

  const handleClear = () => {
    setRefDate(""); setTaskId("list_docs"); setCustomDays(14); setShowTracked(false);
  };

  const handleCopyDeadline = () => {
    if (!result) return;
    const text = [
      `Task: ${task.label}`,
      result.steps[0],
      `Deadline: ${result.deadlineDate.toLocaleDateString("en-JM", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
      `Working days: ${result.isPast ? `${Math.abs(result.workingDaysFromToday)} days ago (PASSED)` : `${result.workingDaysFromToday} days remaining`}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const cardCls = result?.isPast
    ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/[0.07]"
    : result?.isUrgent
    ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/[0.07]"
    : "border-green-200 bg-green-50 dark:border-[#009B3A]/25 dark:bg-[#009B3A]/[0.07]";

  return (
    <div className="space-y-4">
      {/* Task type */}
      <div>
        <label className={labelCls}>Task Type</label>
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={selectCls}>
          {CPR_TASKS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-white/30 italic">{task.description}</p>
      </div>

      {/* Custom days */}
      {task.id === "custom" && (
        <div>
          <label className={labelCls}>Number of Working Days</label>
          <input
            type="number" min={1} value={customDays}
            onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
      )}

      {/* Reference date */}
      <div>
        <label className={labelCls}>{task.dateLabel}</label>
        <input
          type="date" value={refDate}
          onChange={(e) => setRefDate(e.target.value)}
          className={inputCls}
        />
        {trackedSittings.length > 0 && (
          <button
            onClick={() => setShowTracked(!showTracked)}
            className="mt-1.5 flex items-center gap-1 text-[10px] text-[#009B3A] hover:underline"
          >
            <Calendar className="h-3 w-3" />
            Pre-fill from your tracked cases ({trackedSittings.length})
          </button>
        )}
        {showTracked && (
          <div className="mt-1.5 rounded-xl border border-[#009B3A]/20 bg-[#009B3A]/[0.04] divide-y divide-[#009B3A]/[0.08]">
            {trackedSittings.map((s) => (
              <button
                key={s.id}
                onClick={() => { setRefDate(s.event_date!); setShowTracked(false); }}
                className="w-full px-3 py-2 text-left hover:bg-[#009B3A]/[0.08] transition-colors"
              >
                <p className="text-[11px] font-medium text-gray-800 dark:text-white/80 truncate">
                  {s.title || s.case_number || `Case #${s.id}`}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-white/40">
                  {new Date(s.event_date! + "T00:00:00").toLocaleDateString("en-JM", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={cn("rounded-xl border p-4 space-y-3", cardCls)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {result.isPast ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : result.isUrgent ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-[#009B3A]" />
              )}
              <span className={cn(
                "text-[11px] font-semibold",
                result.isPast ? "text-red-600 dark:text-red-400" :
                result.isUrgent ? "text-amber-600 dark:text-amber-400" :
                "text-[#009B3A]",
              )}>
                {result.isPast ? "Deadline Passed" : result.isUrgent ? "Urgent" : "On Track"}
              </span>
            </div>
            <span className="text-[12px] font-bold text-gray-800 dark:text-white">
              {result.deadlineDate.toLocaleDateString("en-JM", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          </div>

          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500 dark:text-white/50">Working days remaining</span>
            <span className={cn(
              "font-bold",
              result.isPast ? "text-red-500" :
              result.isUrgent ? "text-amber-500" : "text-[#009B3A]",
            )}>
              {result.isPast
                ? `${Math.abs(result.workingDaysFromToday)} days ago`
                : `${result.workingDaysFromToday} days`}
            </span>
          </div>

          <button
            onClick={handleCopyDeadline}
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-medium transition-all duration-150 self-start",
              copied
                ? "text-[#009B3A]"
                : "text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/55",
            )}
          >
            {copied ? <CopyCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy result"}
          </button>

          <div className="border-t border-black/[0.06] dark:border-white/10 pt-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
              Calculation
            </p>
            {result.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[#009B3A]/20 text-[9px] font-bold text-[#009B3A] flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-[11px] text-gray-600 dark:text-white/60">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleClear}
        className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Clear
      </button>

      <p className="text-[10px] text-gray-400 dark:text-white/25 italic leading-relaxed">
        Weekends, Ash Wednesday, Good Friday, Easter Monday, National Heroes Day, and other
        Jamaican statutory holidays are excluded. Always verify deadlines with a qualified attorney.
      </p>
    </div>
  );
}

/* ── Tool: PAYE 2025 ── */

function PAYETool() {
  const [gross, setGross] = useState("");
  const [mode, setMode] = useState<"monthly" | "annual">("monthly");
  const [isOver65, setIsOver65] = useState(false);
  const [pension, setPension] = useState("");
  const [copied, setCopied] = useState(false);

  const monthlyGross = useMemo(() => {
    const v = parseFloat(gross.replace(/,/g, "")) || 0;
    return mode === "monthly" ? v : v / 12;
  }, [gross, mode]);

  const monthlyPension = useMemo(() => {
    const v = parseFloat(pension.replace(/,/g, "")) || 0;
    return mode === "monthly" ? v : v / 12;
  }, [pension, mode]);

  const data = useMemo(
    () => (monthlyGross > 0 ? calcPAYE2025(monthlyGross, isOver65, monthlyPension) : null),
    [monthlyGross, isOver65, monthlyPension],
  );

  const handleClear = () => {
    setGross(""); setPension(""); setMode("monthly"); setIsOver65(false);
  };

  const handleCopyPAYE = (d: PAYEResult) => {
    const lines = [
      `Monthly Take-home: ${fmt(d.netMonthly)}`,
      `Gross Pay: ${fmt(d.grossMonthly)}`,
      `NIS (3%): ${fmt(d.nisMonthly)}`,
      `NHT (2%): ${fmt(d.nhtMonthly)}`,
      `Education Tax (2.25%): ${fmt(d.edTaxMonthly)}`,
      `PAYE: ${fmt(d.payeMonthly)}`,
      ...(d.pensionMonthly > 0 ? [`Pension: ${fmt(d.pensionMonthly)}`] : []),
    ].join("\n");
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Monthly / Annual toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.04]">
        {(["monthly", "annual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-all duration-150",
              mode === m
                ? "bg-[#009B3A] text-white"
                : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Over 65 toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-gray-500 dark:text-white/40">Age 65 or over?</label>
        <button
          onClick={() => setIsOver65(!isOver65)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors duration-200",
            isOver65 ? "bg-[#009B3A]" : "bg-gray-300 dark:bg-white/[0.15]",
          )}
        >
          <span className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
            isOver65 ? "translate-x-4" : "translate-x-0.5",
          )} />
        </button>
      </div>

      {/* Gross salary */}
      <div>
        <label className={labelCls}>
          Gross {mode === "monthly" ? "Monthly" : "Annual"} Salary (JMD)
        </label>
        <input
          type="text" value={gross}
          onChange={(e) => setGross(e.target.value)}
          placeholder="e.g. 150,000"
          className={inputCls}
        />
      </div>

      {/* Approved pension */}
      <div>
        <label className={labelCls}>
          Approved Pension Contribution — {mode === "monthly" ? "monthly" : "annual"} (optional)
        </label>
        <input
          type="text" value={pension}
          onChange={(e) => setPension(e.target.value)}
          placeholder="e.g. 5,000"
          className={inputCls}
        />
      </div>

      {data && (
        <>
          {/* Below-threshold banner */}
          {data.belowThreshold && (
            <div className="rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/[0.07] px-4 py-3 flex items-start gap-2.5">
              <CheckCircle className="h-4 w-4 mt-0.5 text-[#009B3A] shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-[#009B3A]">No income tax applies</p>
                <p className="text-[10px] text-gray-500 dark:text-white/40 mt-0.5">
                  Your statutory income is below the {fmt(data.threshold)} threshold.
                  Only NIS, NHT, and Education Tax apply.
                </p>
              </div>
            </div>
          )}

          {/* Large net take-home */}
          <div className="text-center py-1">
            <p className="text-[10px] text-gray-400 dark:text-white/35 uppercase tracking-wider mb-1">
              Monthly Take-home
            </p>
            <p className="text-3xl font-bold text-[#009B3A]">{fmt(data.netMonthly)}</p>
            {mode === "annual" && (
              <p className="text-[11px] text-gray-400 dark:text-white/35 mt-0.5">
                ({fmt(data.netMonthly * 12)} / year)
              </p>
            )}
            <button
              onClick={() => handleCopyPAYE(data)}
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium transition-all duration-150",
                copied
                  ? "text-[#009B3A]"
                  : "text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/55",
              )}
            >
              {copied ? <CopyCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy breakdown"}
            </button>
          </div>

          <DonutChart data={data} />

          {/* Breakdown table */}
          <div className="rounded-xl border border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03] divide-y divide-gray-100 dark:divide-white/[0.05]">
            {[
              { label: "Gross Pay", value: data.grossMonthly, indent: false, highlight: false, dim: false },
              { label: "− NIS (3%, max $12,500/mo)", value: data.nisMonthly, indent: true, highlight: false, dim: false },
              ...(data.pensionMonthly > 0
                ? [{ label: "− Approved Pension", value: data.pensionMonthly, indent: true, highlight: false, dim: false }]
                : []),
              { label: "= Statutory Income", value: data.statutoryMonthly, indent: false, highlight: false, dim: true },
              { label: "− Education Tax (2.25%)", value: data.edTaxMonthly, indent: true, highlight: false, dim: false },
              { label: "− NHT (2%)", value: data.nhtMonthly, indent: true, highlight: false, dim: false },
              { label: "− PAYE Income Tax", value: data.payeMonthly, indent: true, highlight: false, dim: false },
              { label: "Net Take-home", value: data.netMonthly, indent: false, highlight: true, dim: false },
            ].map(({ label, value, indent, highlight, dim }) => (
              <div
                key={label}
                className={cn(
                  "flex justify-between items-center px-3.5 py-2.5 text-[12px]",
                  highlight && "bg-[#009B3A]/[0.07]",
                )}
              >
                <span className={cn(
                  indent ? "pl-3 border-l-2 border-gray-200 dark:border-white/[0.08]" : "",
                  highlight ? "font-semibold text-gray-900 dark:text-white" :
                  dim ? "font-medium text-gray-700 dark:text-white/60" :
                  "text-gray-500 dark:text-white/50",
                )}>
                  {label}
                </span>
                <span className={cn(
                  highlight ? "font-bold text-[#009B3A]" : "font-mono text-gray-600 dark:text-white/60",
                )}>
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-white/25 italic">
            2025 rates (effective April 1, 2025): NIS 3% capped at $150,000/yr, NHT 2%,
            Education Tax 2.25%, PAYE threshold {fmt(data.threshold)}.
            {isOver65 ? " Includes $250,040 over-65 allowance." : ""}
          </p>
        </>
      )}

      <button
        onClick={handleClear}
        className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Clear
      </button>
    </div>
  );
}

/* ── Tool: Court Fees ── */

function CourtFeesTool() {
  const allSections = COURT_FEES_SECTIONS.map((s) => s.section);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(allSections));

  const toggle = (section: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Stamp Office banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-[#FED100]/20 dark:bg-[#FED100]/[0.04] px-4 py-3 flex items-start gap-2.5">
        <ExternalLink className="h-3.5 w-3.5 mt-0.5 text-amber-600 dark:text-[#FED100] shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-amber-700 dark:text-[#FED100]">
            Paid at the Stamp Office
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-[#FED100]/60 mt-0.5">
            Court filing fees are paid at the Stamp Office — not the court registry.
            All fees subject to change; verify before filing.
          </p>
        </div>
      </div>

      {/* Sections */}
      {COURT_FEES_SECTIONS.map((section) => {
        const open = expanded.has(section.section);
        return (
          <div key={section.section} className="space-y-1.5">
            <button
              onClick={() => toggle(section.section)}
              className="w-full flex items-center justify-between group"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/40 group-hover:text-gray-700 dark:group-hover:text-white/60 transition-colors">
                {section.section}
              </p>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-gray-400 dark:text-white/30 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && (
              <div className="rounded-xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] divide-y divide-gray-100 dark:divide-white/[0.05] overflow-hidden">
                {section.items.map((item) => (
                  <div key={item.type} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[12px] text-gray-700 dark:text-white/70 flex-1 leading-snug">
                        {item.type}
                      </p>
                      <p className="text-[13px] font-bold text-[#FED100] shrink-0">{item.fee}</p>
                    </div>
                    <p className="mt-1 text-[9px] text-gray-400 dark:text-white/25 italic">
                      Verify at the Stamp Office. Fees are subject to change.
                    </p>
                  </div>
                ))}
                <div className="px-4 py-2 bg-gray-50 dark:bg-white/[0.02]">
                  <p className="text-[10px] text-gray-400 dark:text-white/30 italic">{section.note}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[10px] text-gray-400 dark:text-white/25 italic">
        All amounts in JMD. Last verified: April 2025.
      </p>
    </div>
  );
}

/* ── Panel Content ── */

function PanelContent({ onClose }: { onClose: () => void }) {
  const [activeTool, setActiveTool] = useState<Tool>(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("chambers_tab") as Tool | null;
      if (s === "deadline" || s === "paye" || s === "fees") return s;
    }
    return "deadline";
  });
  const { sittingIds } = useTracking();

  useEffect(() => {
    localStorage.setItem("chambers_tab", activeTool);
  }, [activeTool]);

  const tabs: { id: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "deadline", label: "Deadlines", icon: Calendar },
    { id: "paye", label: "PAYE", icon: DollarSign },
    { id: "fees", label: "Court Fees", icon: FileText },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-white/[0.07] px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009B3A]/15">
            <Scale className="h-3.5 w-3.5 text-[#009B3A]" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">Chambers</p>
            <p className="text-[10px] text-gray-400 dark:text-white/35">Legal Tools</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-white/[0.05] p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-1.5 text-[11px] font-semibold transition-all duration-150",
                activeTool === id
                  ? "bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
                  : "text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
        {activeTool === "deadline" && <DeadlineCalculator sittingIds={sittingIds} />}
        {activeTool === "paye" && <PAYETool />}
        {activeTool === "fees" && <CourtFeesTool />}
      </div>
    </div>
  );
}

/* ── Chambers Panel ── */

export default function ChambersPanel() {
  const { isOpen, openChambers, closeChambers } = useChambers();
  const touchStartY = useRef(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? closeChambers() : openChambers();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, openChambers, closeChambers]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragY(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragY > 100) closeChambers();
    setDragY(0);
  }, [dragY, closeChambers]);

  return (
    <>
      {/* Desktop: floating trigger */}
      <button
        onClick={openChambers}
        title="Open Chambers (⌘K)"
        className={cn(
          "hidden md:flex fixed bottom-[4.5rem] right-4 z-40 items-center gap-2 rounded-full border border-[#009B3A]/30 bg-white dark:bg-[#0d0d1a] px-4 py-2.5 text-[12px] font-semibold text-[#009B3A] shadow-lg shadow-[#009B3A]/10 transition-all duration-200 hover:bg-[#009B3A]/10 hover:border-[#009B3A]/60",
          isOpen && "opacity-0 pointer-events-none",
        )}
      >
        <Scale className="h-3.5 w-3.5" />
        Chambers
        <kbd className="ml-0.5 inline-flex items-center rounded border border-[#009B3A]/25 bg-[#009B3A]/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#009B3A]/55">
          ⌘K
        </kbd>
      </button>

      {/* Desktop: backdrop */}
      {isOpen && (
        <div className="hidden md:block fixed inset-0 z-[58] bg-black/30" onClick={closeChambers} />
      )}

      {/* Desktop: slide-in panel */}
      <div
        className={cn(
          "hidden md:flex fixed right-0 top-0 z-[60] h-full w-[380px] flex-col",
          "bg-white dark:bg-[#0d0d1a]",
          "border-l border-gray-200/60 dark:border-white/[0.07]",
          "shadow-[-12px_0_60px_rgba(0,0,0,0.12)] dark:shadow-[-12px_0_60px_rgba(0,0,0,0.5)]",
          "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <PanelContent onClose={closeChambers} />
      </div>

      {/* Mobile: backdrop */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-[65] bg-black/50" onClick={closeChambers} />
      )}

      {/* Mobile: bottom sheet with swipe-to-dismiss */}
      <div
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-[68] flex flex-col rounded-t-[20px]",
          "bg-white dark:bg-[#0d0d1a]",
          "border-t border-gray-200/80 dark:border-white/[0.08]",
          "shadow-[0_-12px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_-12px_60px_rgba(0,0,0,0.6)]",
          "max-h-[90vh] overflow-hidden",
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: isOpen
            ? dragY > 0 ? `translateY(${dragY}px)` : "translateY(0)"
            : "translateY(100%)",
          transition: dragY > 0 ? "none" : "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-gray-200 dark:bg-white/[0.14] shrink-0" />
        <PanelContent onClose={closeChambers} />
      </div>
    </>
  );
}
