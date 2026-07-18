"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
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
  Scale,
} from "lucide-react";
import { HigherCourtIcon, CourtroomIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import ServiceAlertBanner from "@/components/ServiceAlertBanner";
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
  { href: "/docket", label: "My Docket" },
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

  useEffect(() => {
    setRole(getRoleFromToken());
  }, []);

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
      {/* Court refresh progress bar */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-[65] h-[2px] pointer-events-none overflow-hidden">
          <div className="h-full w-full bg-primary court-progress-bar opacity-70" />
        </div>
      )}

      <nav className="sticky top-0 z-50 border-b border-border bg-background/92 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-2">

            {/* Logo + Court Tabs */}
            <div className="flex items-center gap-4 shrink-0 min-w-0">
              <Link href="/" className="shrink-0 group">
                <span className="font-heading font-bold text-[17px] tracking-tight whitespace-nowrap">
                  <span className="text-foreground group-hover:text-foreground transition-colors duration-150">Court</span><span className="text-primary">Watch</span><sup className="text-[10px] font-semibold text-accent ml-0.5 tracking-wide">JA</sup>
                </span>
              </Link>

              {/* Desktop court selector — tab underline style */}
              <div className="hidden lg:flex items-center">
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
                      "relative px-3 py-2 text-[11px] font-semibold transition-all duration-150 whitespace-nowrap",
                      selectedCourt === court
                        ? "text-primary"
                        : "text-foreground/35 hover:text-foreground/65",
                    ].join(" ")}
                  >
                    {court}
                    {selectedCourt === court && (
                      <span className="absolute bottom-0 left-2 right-2 h-px bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Center: Desktop nav */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {DESKTOP_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-1.5 text-[13px] font-medium transition-all duration-150 rounded-lg ${
                    isActive(href)
                      ? "text-foreground bg-foreground/[0.05]"
                      : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04]"
                  }`}
                >
                  {label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`relative px-3 py-1.5 text-[13px] font-medium transition-all duration-150 rounded-lg flex items-center gap-1.5 ${
                    isActive("/admin")
                      ? "text-accent bg-accent/[0.06]"
                      : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04]"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Mobile court selector pill */}
              <button
                onClick={() => setCourtSheetOpen(true)}
                className="lg:hidden flex items-center gap-1 rounded-lg border border-primary/25 bg-primary/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors min-h-[44px]"
              >
                <span className="max-w-[68px] truncate hidden sm:inline">
                  {selectedCourt}
                </span>
                <span className="sm:hidden">Court</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>

              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* Bell */}
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 min-h-[44px] rounded-lg text-foreground/35 hover:text-foreground/80 hover:bg-foreground/[0.05] transition-all"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-black ring-2 ring-background">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>

              {/* Profile */}
              <Link href="/profile">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 min-h-[44px] rounded-lg transition-all ${
                    pathname.startsWith("/profile")
                      ? "text-primary bg-primary/[0.08]"
                      : "text-foreground/35 hover:text-foreground/80 hover:bg-foreground/[0.05]"
                  }`}
                >
                  <UserCircle2 className="h-4 w-4" />
                </Button>
              </Link>

              {/* Settings — sm+ */}
              <Link href="/settings" className="hidden sm:block">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground/35 hover:text-foreground/80 hover:bg-foreground/[0.05] transition-all"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>

              <div className="hidden sm:block mx-1 h-4 w-px bg-foreground/[0.07]" />

              {/* Logout — sm+ */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="hidden sm:flex h-8 w-8 rounded-lg text-foreground/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
              >
                <LogOut className="h-4 w-4" />
              </Button>

              {/* More — mobile only */}
              <div ref={moreRef} className="relative sm:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="h-8 w-8 min-h-[44px] rounded-lg text-foreground/35 hover:text-foreground/80 hover:bg-foreground/[0.05]"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-border bg-card shadow-2xl overflow-hidden z-[100]">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <span className="text-[11px] text-foreground/35">Theme</span>
                      <ThemeToggle />
                    </div>
                    <Link
                      href="/docket"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-foreground/55 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                    >
                      <Briefcase className="h-4 w-4" />
                      My Docket
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-foreground/55 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <div className="h-px bg-border" />
                    <button
                      onClick={() => { setMoreOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.07] transition-colors"
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
      <ServiceAlertBanner />

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none">
        <nav
          className="pointer-events-auto flex items-center gap-0 rounded-[22px] border border-border bg-card px-1 py-2 shadow-xl"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
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
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/30 hover:text-foreground/65 hover:bg-foreground/[0.05]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className="h-[19px] w-[19px]"
                    strokeWidth={active ? 2.2 : 1.7}
                  />
                  {id === "alerts" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-black ring-[1.5px] ring-card">
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
            className="relative flex flex-col items-center gap-[3px] rounded-[14px] px-[13px] py-2 transition-all duration-200 text-foreground/30 hover:text-foreground/65 hover:bg-foreground/[0.05]"
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
            className="fixed bottom-0 inset-x-0 z-[75] rounded-t-2xl bg-card border-t border-border px-5 pt-5"
            style={{
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="font-heading text-sm font-semibold text-foreground">Select Court</p>
              <button
                onClick={() => setCourtSheetOpen(false)}
                className="rounded-lg p-1.5 text-foreground/35 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
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
                      ? "bg-primary/[0.08] text-primary"
                      : "text-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground"
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
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-card px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-foreground/85">{notifToast}</p>
          </div>
        </div>
      )}
    </>
  );
}
