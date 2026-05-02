"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <p>Redirecting to dashboard...</p>
    </div>
  );
}
