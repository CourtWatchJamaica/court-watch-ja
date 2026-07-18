"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Megaphone } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { Promo } from "@/lib/types";

export default function PromoModal() {
  const [promo, setPromo] = useState<Promo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    let timer: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        const res = await apiClient.getActivePromo();
        if (res.promo) {
          timer = setTimeout(() => {
            setPromo(res.promo);
            setVisible(true);
          }, 15000);
        }
      } catch {
        // silently ignore
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = async () => {
    setVisible(false);
    if (promo) {
      try {
        await apiClient.dismissPromo(promo.id);
      } catch {
        // silently ignore
      }
    }
  };

  if (!visible || !promo) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      <div className="relative w-full max-w-md rounded-lg border border-white/[0.08] bg-[#0e0e1a] shadow-2xl p-6">
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white/70 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#009B3A]/15">
            <Megaphone className="h-4 w-4 text-[#009B3A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              {promo.title}
            </p>
            <p className="mt-1.5 text-xs text-white/55 leading-relaxed whitespace-pre-wrap">
              {promo.message}
            </p>
            {promo.url && promo.url_text && (
              <a
                href={promo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#009B3A]/15 px-3 py-1.5 text-xs font-semibold text-[#009B3A] hover:bg-[#009B3A]/25 transition-colors"
              >
                {promo.url_text}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleDismiss}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
