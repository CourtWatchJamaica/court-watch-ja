"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    apiClient
      .getMe()
      .then((user) => {
        if (user.role === "admin" || user.role === "super_admin") {
          setAuthorized(true);
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/auth/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#009B3A]" />
      </div>
    );
  }

  return <>{children}</>;
}
