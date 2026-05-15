"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  ShieldCheck,
  UserCircle2,
  MoreHorizontal,
} from "lucide-react";
import { HigherCourtIcon, CourtroomIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { apiClient } from "@/lib/api";
import {
  useCourt,
  COURTS,
  COURT_TO_SLUG,
  type Court,
} from "@/lib/court-context";
import { useChambers } from "@/lib/chambers-context";

const DESKTOP_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/judges", label: "Judges" },
];


function getRoleFromToken(): string | null {
  try {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return null;
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCourt, setSelectedCourt, isRefreshing } = useCourt();
  const { openChambers } = useChambers();
  const [unreadCount, setUnreadCount] = useState(0);
  const [courtSheetOpen, setCourtSheetOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Read role from JWT once on mount (no API call needed — payload is public)
  useEffect(() => {
    setRole(getRoleFromToken());
  }, []);

  // Close "more" dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [moreOpen]);

  // Poll unread count; show toast when new notifications arrive
  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { count } = await apiClient.getNotificationsUnreadCount();
        if (cancelled) return;
        setUnreadCount(count);
        if (prevCountRef.current !== null && count > prevCountRef.current) {
          const diff = count - prevCountRef.current;
          const msg =
            diff === 1
              ? "You have a new case update"
              : `${diff} new case updates`;
          setNotifToast(msg);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setNotifToast(null), 4000);
        }
        prevCountRef.current = count;
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/auth/login");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isAdmin = role === "admin" || role === "super_admin";

  return (
    <>
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-[65] h-[3px] pointer-events-none overflow-hidden">
          <div className="h-full w-full bg-[#009B3A] court-progress-bar" />
        </div>
      )}

      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[3px] z-[50] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
        }}
      />

      <nav className="sticky top-[3px] z-50 border-b border-white/[0.07] bg-[#07070f]/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-1 sm:gap-2">
            {/* Logo + Court Pills */}
            <div className="flex items-center gap-3 shrink-0 min-w-0">
              <Link href="/" className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center justify-center rounded-lg bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30 p-1.5">
                  <HigherCourtIcon className="h-5 w-5 text-[#009B3A]" />
                </div>
                <span className="font-bold text-[17px] tracking-tight text-white whitespace-nowrap">
                  Court<span className="text-[#009B3A]">Watch</span>
                  <span className="text-[#FED100]"> JA</span>
                </span>
              </Link>

              <div className="hidden lg:flex items-center gap-1 ml-1">
                {COURTS.map((court) => (
                  <button
                    key={court}
                    onClick={() => {
                      setSelectedCourt(court);
                      if (court === "Parish Court") {
                        router.push("/parish-court");
                      } else {
                        router.push(`/court/${COURT_TO_SLUG[court]}`);
                      }
                    }}
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

            {/* Center: Desktop nav links */}
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
              {/* Admin link — only for admin/super_admin */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    isActive("/admin")
                      ? "text-[#FED100] bg-[#FED100]/10"
                      : "text-white/45 hover:text-white hover:bg-white/[0.07]"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Court selector pill — visible on < lg, opens bottom sheet */}
              <button
                onClick={() => setCourtSheetOpen(true)}
                className="lg:hidden flex items-center gap-1.5 rounded-full border border-[#009B3A]/40 bg-[#009B3A]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#009B3A] transition-colors hover:bg-[#009B3A]/20 min-h-[44px]"
              >
                <span className="max-w-[72px] truncate hidden sm:inline">
                  {selectedCourt}
                </span>
                <span className="sm:hidden">Court</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>

              {/* ThemeToggle — sm+ only; on mobile it lives in the More dropdown */}
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* Bell — always visible */}
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 min-h-[44px] rounded-lg text-white/40 hover:text-white hover:bg-white/[0.07]"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#009B3A] text-[8px] font-bold text-white ring-2 ring-[#07070f]">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>

              {/* Profile — always visible */}
              <Link href="/profile">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 min-h-[44px] rounded-lg transition-colors ${
                    pathname.startsWith("/profile")
                      ? "text-[#009B3A] bg-[#009B3A]/10"
                      : "text-white/40 hover:text-white hover:bg-white/[0.07]"
                  }`}
                >
                  <UserCircle2 className="h-4 w-4" />
                </Button>
              </Link>

              {/* Settings — sm+ only */}
              <Link href="/settings" className="hidden sm:block">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.07]"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>

              {/* Separator — sm+ only */}
              <div className="hidden sm:block mx-1 h-4 w-px bg-white/[0.08]" />

              {/* Logout — sm+ only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="hidden sm:flex h-9 w-9 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>

              {/* More — mobile only: ThemeToggle, Settings, Logout */}
              <div ref={moreRef} className="relative sm:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="h-9 w-9 min-h-[44px] rounded-lg text-white/40 hover:text-white hover:bg-white/[0.07]"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-white/[0.1] bg-[#0d0d1a] shadow-2xl overflow-hidden z-[100]">
                    {/* Theme */}
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.07]">
                      <span className="text-xs text-white/50">Theme</span>
                      <ThemeToggle />
                    </div>
                    {/* Settings */}
                    <Link
                      href="/settings"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <div className="h-px bg-white/[0.07]" />
                    {/* Logout */}
                    <button
                      onClick={() => { setMoreOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav — untouched */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none">
        <nav
          className="pointer-events-auto flex items-center gap-0 rounded-[22px] border border-white/[0.08] bg-[#0d0d1a]/96 px-1 py-2 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {[
            { href: "/", icon: Home, label: "Home", id: "home" },
            { href: "/cases", icon: Briefcase, label: "Cases", id: "cases" },
            { href: "/judges", icon: Users, label: "Judges", id: "judges" },
            {
              href: "/notifications",
              icon: BellRing,
              label: "Alerts",
              id: "alerts",
            },
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
                  {id === "alerts" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#009B3A] text-[7px] font-bold text-white ring-[1.5px] ring-[#0d0d1a]">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] font-semibold tracking-wide leading-none">
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={openChambers}
            className="relative flex flex-col items-center gap-[3px] rounded-[14px] px-[13px] py-2 transition-all duration-200 text-white/35 hover:text-white/70 hover:bg-white/[0.07]"
          >
            <CourtroomIcon className="h-[19px] w-[19px]" />
            <span className="text-[9.5px] font-semibold tracking-wide leading-none">
              Chambers
            </span>
          </button>
        </nav>
      </div>

      {/* Court selector bottom sheet */}
      {courtSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            onClick={() => setCourtSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-[75] rounded-t-2xl bg-[#0d0d1a] border-t border-white/[0.1] px-5 pt-5"
            style={{
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            }}
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
                  onClick={() => {
                    setSelectedCourt(court);
                    setCourtSheetOpen(false);
                    if (court === "Parish Court") {
                      router.push("/parish-court");
                    } else {
                      router.push(`/court/${COURT_TO_SLUG[court]}`);
                    }
                  }}
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

      {/* New notification toast */}
      {notifToast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <Bell className="h-4 w-4 text-[#009B3A] shrink-0" />
            <p className="text-sm text-white/90">{notifToast}</p>
          </div>
        </div>
      )}
    </>
  );
}
