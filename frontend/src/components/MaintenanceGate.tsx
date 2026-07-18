"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function getRoleFromToken(): string | null {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return null;
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64))?.role ?? null;
  } catch {
    return null;
  }
}

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) {
      setMaintenance(false);
      setChecked(true);
      return;
    }
    fetch(`${BASE_URL}/maintenance/status`)
      .then((r) => r.json())
      .then(({ maintenance_mode }) => {
        setMaintenance(!!maintenance_mode);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [pathname]);

  if (!checked) return <>{children}</>;

  const role = getRoleFromToken();
  const isAdmin = role === "admin" || role === "super_admin";

  if (maintenance && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div
          className="fixed top-0 left-0 right-0 h-[3px] z-50"
          style={{
            background:
              "linear-gradient(to right, #111111 33.33%, #009B3A 33.33%, #009B3A 66.66%, #FED100 66.66%)",
          }}
        />
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-[#FED100]/10 ring-1 ring-[#FED100]/25">
            <Wrench className="h-8 w-8 text-[#FED100]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Down for Maintenance
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CourtWatch JA is temporarily unavailable while we make improvements.
            We&apos;ll be back shortly.
          </p>
          <p className="mt-8 text-[11px] text-muted-foreground/40">
            Jamaica&apos;s premier legal case tracker
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
