"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import {
  Scale,
  Users,
  Database,
  Cpu,
  ScrollText,
  Settings,
  LogOut,
  ChevronRight,
  Upload,
  Megaphone,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: Scale, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/data", label: "Data", icon: Database },
  { href: "/admin/scraper", label: "Scraper", icon: Cpu },
  { href: "/admin/upload", label: "Upload", icon: Upload },
  { href: "/admin/announce", label: "Announce", icon: Megaphone },
  { href: "/admin/promos", label: "Promos", icon: Sparkles },
  { href: "/admin/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/config", label: "Config", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/auth/login");
  };

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-[#0a0a0a]">
        {/* Sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0d1a]">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#009B3A]/20">
              <Scale className="h-4 w-4 text-[#009B3A]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white leading-none">CourtWatch JA</p>
              <p className="text-[9px] text-[#FED100] font-semibold mt-0.5 uppercase tracking-widest">
                Admin
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-[#009B3A]/12 text-[#009B3A]"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#009B3A]" : "text-white/35 group-hover:text-white/60"}`} />
                  <span className="flex-1 font-medium">{label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-[#009B3A]/60" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/40 hover:bg-white/[0.04] hover:text-white/70 transition-colors"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              <span className="font-medium">Back to App</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="md:hidden fixed inset-x-0 top-0 z-50 flex items-center gap-3 border-b border-white/[0.06] bg-[#0d0d1a] px-4 py-3">
          <Scale className="h-4 w-4 text-[#009B3A]" />
          <span className="text-sm font-bold text-white">Admin</span>
          <div className="flex-1" />
          {NAV.slice(1).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                isActive(href)
                  ? "bg-[#009B3A]/12 text-[#009B3A]"
                  : "text-white/40 hover:text-white/70"
              }`}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Link>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
