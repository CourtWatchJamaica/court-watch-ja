"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Scale,
  Bell,
  Settings,
  LogOut,
  Home,
  Briefcase,
  Users,
  BellRing,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { apiClient } from "@/lib/api";
import { useCourt, COURTS, type Court } from "@/lib/court-context";
import { useChambers } from "@/lib/chambers-context";

const DESKTOP_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/judges", label: "Judges" },
];

/* Gavel SVG used for Chambers tab icon (avoids lucide version uncertainty) */
function GavelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCourt, setSelectedCourt, isRefreshing } = useCourt();
  const { openChambers } = useChambers();
  const [notifCount, setNotifCount] = useState(0);
  const [courtSheetOpen, setCourtSheetOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/auth/login");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const { notifications } = await apiClient.getNotifications();
        if (!cancelled) setNotifCount(notifications.length);
      } catch {
        /* not authenticated yet */
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    setCourtSheetOpen(false);
  };

  return (
    <>
      {/* ── Court-change loading bar — sits above flag bar ── */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-[65] h-[3px] pointer-events-none overflow-hidden">
          <div className="h-full w-full bg-[#009B3A] court-progress-bar" />
        </div>
      )}

      {/* ── Jamaican flag accent bar ── */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[3px] z-[50] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
        }}
      />

      {/* ── Top bar — always dark ── */}
      <nav className="sticky top-[3px] z-50 border-b border-white/[0.07] bg-[#07070f]/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-2">

            {/* ── Left: Logo + Court Pills (lg+) ── */}
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/" className="flex items-center gap-2.5 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
                  <Scale className="h-4 w-4 text-[#009B3A]" />
                </div>
                <span className="font-bold text-[17px] tracking-tight text-white">
                  Court<span className="text-[#009B3A]">Watch</span>
                  <span className="text-[#FED100]"> JA</span>
                </span>
              </Link>

              {/* Desktop court pills — lg+ only */}
              <div className="hidden lg:flex items-center gap-1 ml-1">
                {COURTS.map((court) => (
                  <button
                    key={court}
                    onClick={() => setSelectedCourt(court)}
                    className={[
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 whitespace-nowrap",
                      selectedCourt === court
                        ? "bg-[#009B3A] text-white shadow-[0_0_14px_rgba(0,155,58,0.45)]"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.07] border border-white/[0.08]",
                    ].join(" ")}
                  >
                    {court === "Supreme Court" ? "⚖ " : ""}
                    {court}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Center: Desktop nav links (md+) ── */}
            <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
              {DESKTOP_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(href)
                      ? "text-[#009B3A] bg-[#009B3A]/10"
                      : "text-white/45 hover:text-white hover:bg-white/[0.07]"
                  }`}
                >
                  {label}
                  {isActive(href) && (
                    <span className="absolute -bottom-[1px] left-3 right-3 h-px rounded-full bg-[#009B3A]/60" />
                  )}
                </Link>
              ))}
            </div>

            {/* ── Right: Court chip (< lg) + actions ── */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Court chip — visible on mobile + tablet, hidden on lg+ */}
              <button
                onClick={() => setCourtSheetOpen(true)}
                className="lg:hidden flex items-center gap-1.5 rounded-full border border-[#009B3A]/40 bg-[#009B3A]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#009B3A] transition-colors hover:bg-[#009B3A]/20"
              >
                <span className="max-w-[72px] truncate hidden sm:inline">{selectedCourt}</span>
                <span className="sm:hidden">Court</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>

              <ThemeToggle />
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.07]"
                >
                  <Bell className="h-4 w-4" />
                  {notifCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#009B3A] ring-2 ring-[#07070f]" />
                  )}
                </Button>
              </Link>
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.07]"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <div className="mx-1 h-4 w-px bg-white/[0.08]" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-9 w-9 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile floating bottom nav — 5 tabs ── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none">
        <nav
          className="pointer-events-auto flex items-center gap-0 rounded-[22px] border border-white/[0.08] bg-[#0d0d1a]/96 px-1 py-2 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Regular nav tabs */}
          {[
            { href: "/", icon: Home, label: "Home", id: "home" },
            { href: "/cases", icon: Briefcase, label: "Cases", id: "cases" },
            { href: "/judges", icon: Users, label: "Judges", id: "judges" },
            { href: "/notifications", icon: BellRing, label: "Alerts", id: "alerts" },
          ].map(({ href, icon: Icon, label, id }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center gap-[3px] rounded-[14px] px-[13px] py-2 transition-all duration-200 ${
                  active
                    ? "bg-[#009B3A]/15 text-[#009B3A]"
                    : "text-white/35 hover:text-white/70 hover:bg-white/[0.07]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className="h-[19px] w-[19px]"
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  {id === "alerts" && notifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#009B3A] ring-2 ring-[#0d0d1a]" />
                  )}
                </div>
                <span className="text-[9.5px] font-semibold tracking-wide leading-none">
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Chambers tab — opens panel instead of navigating */}
          <button
            onClick={openChambers}
            className="relative flex flex-col items-center gap-[3px] rounded-[14px] px-[13px] py-2 transition-all duration-200 text-white/35 hover:text-white/70 hover:bg-white/[0.07]"
          >
            <GavelIcon className="h-[19px] w-[19px]" />
            <span className="text-[9.5px] font-semibold tracking-wide leading-none">
              Chambers
            </span>
          </button>
        </nav>
      </div>

      {/* ── Court selector bottom sheet (mobile + tablet) ── */}
      {courtSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            onClick={() => setCourtSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-[75] rounded-t-2xl bg-[#0d0d1a] border-t border-white/[0.1] px-5 pt-5"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Select Court</p>
              <button
                onClick={() => setCourtSheetOpen(false)}
                className="rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/[0.07]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {COURTS.map((court) => (
                <button
                  key={court}
                  onClick={() => handleCourtSelect(court)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-150 text-left ${
                    selectedCourt === court
                      ? "bg-[#009B3A]/15 text-[#009B3A]"
                      : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Scale className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium flex-1">{court}</span>
                  {selectedCourt === court && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
