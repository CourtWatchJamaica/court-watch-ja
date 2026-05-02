"use client";

import { useState, useMemo } from "react";
import { X, Clock, DollarSign, FileText, Scale } from "lucide-react";
import { useChambers } from "@/lib/chambers-context";
import { cn } from "@/lib/utils";

/* ── Types ── */

type Tool = "time" | "paye" | "fees";

/* ── Court Fees Data ── */

const COURT_FEES = [
  { type: "Fixed Date Claim — under JMD 100,000", fee: "JMD 1,500 – 3,000" },
  { type: "Fixed Date Claim — JMD 100K to 1M", fee: "JMD 5,000 – 10,000" },
  { type: "Fixed Date Claim — over JMD 1M", fee: "JMD 15,000 – 25,000" },
  { type: "Divorce Petition", fee: "JMD 5,000 – 15,000" },
  { type: "Statutory Demand", fee: "JMD 3,000 – 7,000" },
  { type: "Writ of Summons", fee: "JMD 5,000 – 20,000" },
  { type: "Affidavit / Sworn Statement", fee: "JMD 1,000 – 3,000" },
  { type: "Injunction / Interlocutory Order", fee: "JMD 8,000 – 20,000" },
] as const;

/* ── PAYE Calculator (Jamaica 2024 rates) ── */

function calcPAYE(monthlyGross: number) {
  const annual = monthlyGross * 12;
  const threshold = 1_500_096;
  const nisCap = 5_000_000;

  const nisAnnual = Math.min(annual, nisCap) * 0.03;
  const nhtAnnual = annual * 0.02;
  const edTaxAnnual = annual * 0.0225;

  const taxable = Math.max(0, annual - threshold);
  let payeAnnual = 0;
  if (taxable > 0) {
    const band1Limit = 6_000_000 - threshold;
    payeAnnual =
      Math.min(taxable, band1Limit) * 0.25 +
      Math.max(0, taxable - band1Limit) * 0.3;
  }

  const netAnnual = annual - nisAnnual - nhtAnnual - edTaxAnnual - payeAnnual;

  return {
    gross: monthlyGross,
    nis: nisAnnual / 12,
    nht: nhtAnnual / 12,
    edTax: edTaxAnnual / 12,
    paye: payeAnnual / 12,
    net: netAnnual / 12,
  };
}

/* ── Time Served Calculator ── */

function calcRelease(
  years: number,
  months: number,
  days: number,
  startDate: string,
  remission: "third" | "half",
) {
  if (!startDate) return null;
  const totalDays = years * 365 + months * 30 + days;
  if (totalDays <= 0) return null;
  const fraction = remission === "third" ? 2 / 3 : 1 / 2;
  const daysToServe = Math.round(totalDays * fraction);

  const start = new Date(startDate);
  const release = new Date(start);
  release.setDate(release.getDate() + daysToServe);

  const daysServed = Math.max(
    0,
    Math.floor((Date.now() - start.getTime()) / 86_400_000),
  );
  const daysRemaining = Math.max(0, daysToServe - daysServed);
  const pct = Math.min(100, Math.round((daysServed / daysToServe) * 100));

  const remYears = Math.floor(daysRemaining / 365);
  const remMonths = Math.floor((daysRemaining % 365) / 30);
  const remDays = daysRemaining % 30;

  return { release, daysToServe, daysServed, daysRemaining, pct, remYears, remMonths, remDays };
}

/* ── Formatting ── */

const fmt = (n: number) =>
  "JMD " +
  n.toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── CSS Donut chart ── */

function DonutChart({ data }: { data: ReturnType<typeof calcPAYE> }) {
  const slices = [
    { label: "Net Pay", value: data.net, color: "#009B3A" },
    { label: "PAYE", value: data.paye, color: "#FED100" },
    { label: "NIS", value: data.nis, color: "#3b82f6" },
    { label: "NHT", value: data.nht, color: "#a855f7" },
    { label: "Ed. Tax", value: data.edTax, color: "#f97316" },
  ];
  let cum = 0;
  const gradient = slices
    .map(({ color, value }) => {
      const pct = (value / data.gross) * 100;
      const s = cum;
      cum += pct;
      return `${color} ${s.toFixed(2)}% ${cum.toFixed(2)}%`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-[#0d0d1a] flex items-center justify-center">
            <span className="text-[9px] font-semibold text-white/40 text-center leading-tight">
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
              <span className="text-[10px] text-white/50">{label}</span>
            </div>
            <span className="text-[10px] font-mono text-white/60">
              {fmt(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tool: Time Served ── */

function TimeServedTool() {
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(0);
  const [days, setDays] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [remission, setRemission] = useState<"third" | "half">("third");

  const result = useMemo(
    () => calcRelease(years, months, days, startDate, remission),
    [years, months, days, startDate, remission],
  );

  const inputCls =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-[#009B3A]/60 focus:ring-1 focus:ring-[#009B3A]/30";

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Sentence Length
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Years", val: years, set: setYears },
            { label: "Months", val: months, set: setMonths },
            { label: "Days", val: days, set: setDays },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="mb-1 block text-[10px] text-white/35">{label}</label>
              <input
                type="number"
                min={0}
                value={val}
                onChange={(e) => set(Math.max(0, parseInt(e.target.value) || 0))}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-white/35">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputCls + " [color-scheme:dark]"}
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Remission
        </p>
        <div className="flex gap-2">
          {(
            [
              { id: "third" as const, label: "Standard (⅓ off)" },
              { id: "half" as const, label: "Enhanced (½ off)" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setRemission(id)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium transition-all duration-150",
                remission === id
                  ? "border-[#009B3A]/50 bg-[#009B3A]/15 text-[#009B3A]"
                  : "border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/[0.07] p-4 space-y-3">
          <div className="flex justify-between text-[12px]">
            <span className="text-white/50">Release Date</span>
            <span className="font-semibold text-white">
              {result.release.toLocaleDateString("en-JM", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-white/50">Time Remaining</span>
            <span className="font-semibold text-white">
              {result.remYears > 0 && `${result.remYears}y `}
              {result.remMonths > 0 && `${result.remMonths}mo `}
              {result.remDays}d
            </span>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[10px] text-white/40">
              <span>Progress</span>
              <span>{result.pct}% served</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[#009B3A] transition-all duration-500"
                style={{ width: `${result.pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-white/25 italic leading-relaxed">
        Estimate only based on standard Jamaican remission rules. Always verify
        with official sources.
      </p>
    </div>
  );
}

/* ── Tool: PAYE ── */

function PAYETool() {
  const [gross, setGross] = useState("");
  const [mode, setMode] = useState<"monthly" | "annual">("monthly");

  const monthlyGross = useMemo(() => {
    const val = parseFloat(gross.replace(/,/g, "")) || 0;
    return mode === "monthly" ? val : val / 12;
  }, [gross, mode]);

  const data = useMemo(
    () => (monthlyGross > 0 ? calcPAYE(monthlyGross) : null),
    [monthlyGross],
  );

  const inputCls =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-[#009B3A]/60 focus:ring-1 focus:ring-[#009B3A]/30";

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.04]">
        {(["monthly", "annual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-all duration-150",
              mode === m
                ? "bg-[#009B3A] text-white"
                : "text-white/40 hover:text-white/60",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-white/35">
          Gross {mode === "monthly" ? "Monthly" : "Annual"} Salary (JMD)
        </label>
        <input
          type="text"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          placeholder="e.g. 150,000"
          className={inputCls}
        />
      </div>

      {data && data.gross > 0 && (
        <>
          <DonutChart data={data} />

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] divide-y divide-white/[0.05]">
            {[
              { label: "Gross Pay", value: data.gross, highlight: false },
              { label: "PAYE Income Tax", value: data.paye, highlight: false },
              { label: "NIS Contribution", value: data.nis, highlight: false },
              { label: "NHT Contribution", value: data.nht, highlight: false },
              { label: "Education Tax", value: data.edTax, highlight: false },
              { label: "Net Take-home", value: data.net, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={cn(
                  "flex justify-between items-center px-3.5 py-2.5 text-[12px]",
                  highlight && "bg-[#009B3A]/[0.07]",
                )}
              >
                <span className={highlight ? "font-semibold text-white" : "text-white/50"}>
                  {label}
                </span>
                <span
                  className={
                    highlight
                      ? "font-bold text-[#009B3A]"
                      : "font-mono text-white/60"
                  }
                >
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/25 italic">
            Rates: NIS 3%, NHT 2%, Ed. Tax 2.25%, PAYE threshold JMD 1,500,096.
          </p>
        </>
      )}
    </div>
  );
}

/* ── Tool: Court Fees ── */

function CourtFeesTool() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/40 mb-3">
        Select a filing type to see estimated fee range.
      </p>
      {COURT_FEES.map((item, i) => (
        <button
          key={i}
          onClick={() => setSelected(selected === i ? null : i)}
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-left transition-all duration-150",
            selected === i
              ? "border-[#009B3A]/40 bg-[#009B3A]/[0.08]"
              : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]",
          )}
        >
          <p className="text-[12px] font-medium text-white/80">{item.type}</p>
          {selected === i && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-white/40">Filing fee:</span>
              <span className="text-[13px] font-bold text-[#FED100]">{item.fee}</span>
            </div>
          )}
        </button>
      ))}
      <p className="pt-1 text-[10px] text-white/25 italic">
        Fees are estimates. Confirm with the court registry before filing.
      </p>
    </div>
  );
}

/* ── Panel Content ── */

function PanelContent({ onClose }: { onClose: () => void }) {
  const [activeTool, setActiveTool] = useState<Tool>("time");

  const tabs: { id: Tool; label: string; icon: typeof Clock }[] = [
    { id: "time", label: "Time Served", icon: Clock },
    { id: "paye", label: "PAYE", icon: DollarSign },
    { id: "fees", label: "Court Fees", icon: FileText },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009B3A]/15">
            <Scale className="h-3.5 w-3.5 text-[#009B3A]" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white">Chambers</p>
            <p className="text-[10px] text-white/35">Legal Tools</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/[0.07] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-0.5 border-b border-white/[0.06] px-3 pt-3 pb-0 shrink-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[11px] font-semibold transition-all duration-150 border-b-2",
              activeTool === id
                ? "border-[#009B3A] text-[#009B3A] bg-[#009B3A]/[0.06]"
                : "border-transparent text-white/40 hover:text-white/60 hover:bg-white/[0.04]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tool content — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
        {activeTool === "time" && <TimeServedTool />}
        {activeTool === "paye" && <PAYETool />}
        {activeTool === "fees" && <CourtFeesTool />}
      </div>
    </div>
  );
}

/* ── Chambers Panel (desktop slide-in + mobile bottom sheet) ── */

export default function ChambersPanel() {
  const { isOpen, openChambers, closeChambers } = useChambers();

  return (
    <>
      {/* ── Desktop: floating trigger button ── */}
      <button
        onClick={openChambers}
        className={cn(
          "hidden md:flex fixed bottom-[4.5rem] right-4 z-40 items-center gap-2 rounded-full border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-2.5 text-[12px] font-semibold text-[#009B3A] shadow-lg shadow-[#009B3A]/10 transition-all duration-200 hover:bg-[#009B3A]/10 hover:border-[#009B3A]/60",
          isOpen && "opacity-0 pointer-events-none",
        )}
      >
        <Scale className="h-3.5 w-3.5" />
        Chambers
      </button>

      {/* ── Desktop: slide-in right panel ── */}
      {isOpen && (
        <div
          className="hidden md:block fixed inset-0 z-[58] bg-black/30"
          onClick={closeChambers}
        />
      )}
      <div
        className={cn(
          "hidden md:flex fixed right-0 top-0 z-[60] h-full w-[380px] flex-col bg-[#0d0d1a] border-l border-white/[0.07] shadow-[-8px_0_48px_rgba(0,0,0,0.4)]",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <PanelContent onClose={closeChambers} />
      </div>

      {/* ── Mobile: bottom sheet ── */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-[65] bg-black/50"
          onClick={closeChambers}
        />
      )}
      <div
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-[68] flex flex-col rounded-t-2xl bg-[#0d0d1a] border-t border-white/[0.08] shadow-[0_-8px_48px_rgba(0,0,0,0.5)]",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-y-0" : "translate-y-full",
          "max-h-[85vh]",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-white/[0.12]" />
        <PanelContent onClose={closeChambers} />
      </div>
    </>
  );
}
