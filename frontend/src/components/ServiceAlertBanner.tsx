"use client";

import { useEffect, useState } from "react";
import { X, Info, AlertTriangle, AlertOctagon } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { ServiceAlert } from "@/lib/types";

const SEVERITY_STYLES = {
  info: {
    wrapper: "border-b border-blue-500/20 bg-blue-500/[0.07]",
    icon: Info,
    iconColor: "text-blue-400",
    titleColor: "text-blue-300",
  },
  warning: {
    wrapper: "border-b border-amber-500/20 bg-amber-500/[0.07]",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    titleColor: "text-amber-300",
  },
  critical: {
    wrapper: "border-b border-red-500/20 bg-red-500/[0.08]",
    icon: AlertOctagon,
    iconColor: "text-red-400",
    titleColor: "text-red-300",
  },
};

export default function ServiceAlertBanner() {
  const [alert, setAlert] = useState<ServiceAlert | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiClient
      .getServiceAlert()
      .then((res) => {
        if (!res.alert?.enabled) return;
        const key = `cwja_alert_${res.alert.title}_${res.alert.severity}`;
        if (sessionStorage.getItem(key)) return;
        setAlert(res.alert);
      })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    if (alert) {
      sessionStorage.setItem(`cwja_alert_${alert.title}_${alert.severity}`, "1");
    }
    setDismissed(true);
  };

  if (dismissed || !alert || !alert.enabled) return null;

  const s =
    SEVERITY_STYLES[alert.severity as keyof typeof SEVERITY_STYLES] ??
    SEVERITY_STYLES.info;
  const Icon = s.icon;

  return (
    <div className={`${s.wrapper} px-4 py-2.5`}>
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.iconColor}`} />
        <p className="flex-1 min-w-0 text-sm leading-snug">
          {alert.title && (
            <span className={`font-semibold ${s.titleColor}`}>
              {alert.title}:{" "}
            </span>
          )}
          <span className="text-white/65">{alert.message}</span>
        </p>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className="shrink-0 text-white/25 hover:text-white/55 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
