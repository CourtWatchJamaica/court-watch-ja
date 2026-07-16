"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { Megaphone, Loader2, CheckCircle2, Users, Mail } from "lucide-react";

export default function AdminAnnouncePage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [promo, setPromo] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: boolean;
    user_count: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.adminAnnounce(title.trim(), message.trim(), promo);
      setResult(res);
      setTitle("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send announcement");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 focus:bg-black/50 transition-colors";

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Megaphone className="h-5 w-5 text-[#FED100]" />
        <div>
          <h1 className="text-xl font-bold text-white">Send Announcement</h1>
          <p className="text-xs text-white/70 mt-0.5">
            Broadcast a message to all registered users
          </p>
        </div>
      </div>

      {/* Info card */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#FED100]/15 bg-[#FED100]/[0.04] px-4 py-3.5">
        <Users className="h-4 w-4 text-[#FED100]/70 shrink-0 mt-0.5" />
        <p className="text-xs text-white/50 leading-relaxed">
          The announcement will appear in each user&apos;s notification list and
          trigger an in-app toast the next time they load the app.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-1.5">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled Maintenance on Friday"
            maxLength={120}
          />
          <p className="mt-1 text-right text-[10px] text-white/50">
            {title.length}/120
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-1.5">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            className={inputCls + " resize-none"}
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your announcement here…"
            maxLength={2000}
          />
          <p className="mt-1 text-right text-[10px] text-white/50">
            {message.length}/2000
          </p>
        </div>

        {/* Promo email toggle */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => setPromo((p) => !p)}
            className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              promo ? "bg-[#FED100]" : "bg-white/[0.12]"
            }`}
          >
            <span
              className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                promo ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-[#FED100]/60 shrink-0" />
            <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
              Send as promotional email to all users
            </span>
          </div>
        </label>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-[#009B3A]/25 bg-[#009B3A]/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#009B3A] shrink-0" />
              <p className="text-sm font-semibold text-[#009B3A]">
                Announcement sent to{" "}
                <span className="font-bold">{result.user_count}</span>{" "}
                {result.user_count === 1 ? "user" : "users"}
              </p>
            </div>
          </div>
        )}

        {/* Preview */}
        {(title || message) && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55 mb-3">
              Preview
            </p>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FED100]/15">
                <Megaphone className="h-4 w-4 text-[#FED100]" />
              </div>
              <div>
                {title && (
                  <p className="text-sm font-semibold text-white">{title}</p>
                )}
                {message && (
                  <p className="mt-1 text-xs text-white/55 leading-relaxed whitespace-pre-wrap">
                    {message}
                  </p>
                )}
                <p className="mt-2 text-[10px] text-white/50">Just now</p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FED100] py-3 text-sm font-bold text-black hover:bg-[#FED100]/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Megaphone className="h-4 w-4" />
              Send to All Users
            </>
          )}
        </button>
      </form>
    </div>
  );
}
