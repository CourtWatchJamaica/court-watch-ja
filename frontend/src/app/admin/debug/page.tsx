"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { NotifDebugResult } from "@/lib/types";
import {
  Bug,
  CheckCircle2,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "Z").toLocaleString("en-JM", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Jamaica",
  });
}

function Flag({ on, label }: { on: boolean | null; label: string }) {
  const enabled = on !== false; // null = default (on)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
        enabled ? "bg-[#009B3A]/15 text-[#009B3A]" : "bg-red-500/10 text-red-400"
      }`}
    >
      {enabled ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">{title}</h2>
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-4">{children}</div>
    </div>
  );
}

export default function AdminDebugPage() {
  const [email, setEmail] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [result, setResult] = useState<NotifDebugResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await apiClient.adminDebugNotifications(email.trim(), caseNumber.trim() || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "h-[44px] rounded-xl border border-white/[0.08] bg-[#0d0d1a] px-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 transition-colors";

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Bug className="h-5 w-5 text-[#FED100]" />
        <div>
          <h1 className="text-xl font-bold text-white">Notification Debugger</h1>
          <p className="text-xs text-white/70 mt-0.5">
            &ldquo;Why didn&rsquo;t this user get notified?&rdquo; — enter their email (and optionally a case number)
          </p>
        </div>
      </div>

      <form onSubmit={run} className="mb-6 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          type="email"
          required
          className={`${inputCls} flex-1 min-w-[220px]`}
        />
        <input
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          placeholder="Case number (optional)"
          className={`${inputCls} w-56`}
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] flex items-center gap-2 rounded-xl bg-[#009B3A] px-5 text-sm font-semibold text-white hover:bg-[#009B3A]/85 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Look up
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && !result.found && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          No account exists with that email.
        </div>
      )}

      {result?.found && result.user && (
        <>
          <Section title="Account">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white">
              <span className="font-semibold">{result.user.email}</span>
              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/60">
                {result.user.role}
              </span>
              {result.user.email_verified ? (
                <span className="text-[11px] text-[#009B3A]">verified</span>
              ) : (
                <span className="text-[11px] text-red-400">
                  NOT verified — no emails are delivered to unverified signups until they verify
                </span>
              )}
            </div>
          </Section>

          <Section title={`Tracked cases (${result.tracked?.length ?? 0})`}>
            {!result.tracked?.length ? (
              <p className="text-xs text-white/60">
                Not tracking {caseNumber ? "this case" : "anything"} — that is why no alerts fire.
              </p>
            ) : (
              <div className="space-y-3">
                {result.tracked.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-white/80">
                      {t.resolved_case_number ?? "(unresolved)"}
                    </span>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/60">
                      {t.case_type}
                    </span>
                    {t.case_id === null && (
                      <span className="text-[10px] text-amber-400" title="Waiting for a sitting or judgment to appear">
                        number-only (awaiting match)
                      </span>
                    )}
                    <Flag on={t.notify_immediately} label="immediate" />
                    <Flag on={t.notify_day_before} label="day before" />
                    <Flag on={t.notify_morning_of} label="morning of" />
                  </div>
                ))}
              </div>
            )}
          </Section>

          {caseNumber && (
            <Section title={`On record for “${caseNumber}”`}>
              {!result.matching_sittings?.length && !result.matching_judgments?.length ? (
                <p className="text-xs text-white/60">
                  Nothing in the database matches this case number — no sittings, no judgment. Alerts
                  can only fire once the scraper picks the case up.
                </p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {result.matching_judgments?.map((j) => (
                    <p key={`j${j.id}`} className="text-white/75">
                      Judgment <span className="font-mono">{j.case_number}</span>
                      {j.title ? ` — ${j.title}` : ""}
                    </p>
                  ))}
                  {result.matching_sittings?.map((s) => (
                    <p key={`s${s.id}`} className="text-white/75">
                      Sitting <span className="font-mono">{s.case_number}</span> — {s.event_date ?? "no date"}{" "}
                      <span className="text-white/50">
                        ({s.event_type ?? "?"}, {s.court_division ?? "?"})
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title={`Notifications recorded (${result.notifications?.length ?? 0})`}>
            {!result.notifications?.length ? (
              <p className="text-xs text-white/60">None recorded{caseNumber ? " for this case" : ""}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-white/50">
                      <th className="py-1 pr-4">Type</th>
                      <th className="py-1 pr-4">Case</th>
                      <th className="py-1 pr-4">Created</th>
                      <th className="py-1 pr-4">Emailed</th>
                      <th className="py-1">Read</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {result.notifications.map((n) => (
                      <tr key={n.id} className="text-white/75">
                        <td className="py-1.5 pr-4">{n.type ?? "—"}</td>
                        <td className="py-1.5 pr-4 font-mono">{n.resolved_case_number ?? "—"}</td>
                        <td className="py-1.5 pr-4">{fmtDateTime(n.sent_at)}</td>
                        <td className="py-1.5 pr-4">
                          {n.emailed_at && n.sent_at && n.emailed_at > n.sent_at ? (
                            fmtDateTime(n.emailed_at)
                          ) : n.emailed_at ? (
                            <span className="text-white/50">not emailed</span>
                          ) : (
                            <span className="text-amber-400">pending</span>
                          )}
                        </td>
                        <td className="py-1.5">{n.read_at ? fmtDateTime(n.read_at) : "unread"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
