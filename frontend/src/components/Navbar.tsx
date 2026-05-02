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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { apiClient } from "@/lib/api";

const DESKTOP_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/judges", label: "Judges" },
];

const MOBILE_TABS = [
  { href: "/", icon: Home, label: "Home", id: "home" },
  { href: "/cases", icon: Briefcase, label: "Cases", id: "cases" },
  { href: "/judges", icon: Users, label: "Judges", id: "judges" },
  { href: "/notifications", icon: BellRing, label: "Alerts", id: "alerts" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [notifCount, setNotifCount] = useState(0);

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
        // not authenticated yet — stay silent
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* ── Jamaican flag accent bar — always visible ── */}
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
          <div className="flex h-16 items-center justify-between">
            {/* Logo + desktop links */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009B3A]/15 ring-1 ring-[#009B3A]/30">
                  <Scale className="h-4 w-4 text-[#009B3A]" />
                </div>
                <span className="font-bold text-[17px] tracking-tight text-white">
                  Court<span className="text-[#009B3A]">Watch</span>
                  <span className="text-[#FED100]"> JA</span>
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-0.5">
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
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-0.5">
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
              <div className="mx-1.5 h-4 w-px bg-white/[0.08]" />
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

      {/* ── Mobile floating bottom nav — always dark ── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto flex items-center gap-0.5 rounded-[22px] border border-white/[0.08] bg-[#0d0d1a]/96 px-2 py-2 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {MOBILE_TABS.map(({ href, icon: Icon, label, id }) => (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-[3px] rounded-[14px] px-[18px] py-2 transition-all duration-200 ${
                isActive(href)
                  ? "bg-[#009B3A]/15 text-[#009B3A]"
                  : "text-white/35 hover:text-white/70 hover:bg-white/[0.07]"
              }`}
            >
              <div className="relative">
                <Icon
                  className="h-[19px] w-[19px]"
                  strokeWidth={isActive(href) ? 2.2 : 1.8}
                />
                {id === "alerts" && notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#009B3A] ring-2 ring-[#0d0d1a]" />
                )}
              </div>
              <span className="text-[9.5px] font-semibold tracking-wide leading-none">
                {label}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
