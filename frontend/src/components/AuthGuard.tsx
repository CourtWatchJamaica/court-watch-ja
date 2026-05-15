"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    apiClient
      .getMe()
      .then((user) => {
        if (user.email_verified === false) {
          router.replace("/check-email");
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        router.replace("/auth/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#009B3A]" />
      </div>
    );
  }

  return <>{children}</>;
}
