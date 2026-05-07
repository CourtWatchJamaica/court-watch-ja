"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import type { User } from "@/lib/types";
import {
  UserCircle2,
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: "Super Admin", color: "text-[#FED100]", bg: "bg-[#FED100]/10" },
  admin:       { label: "Admin",       color: "text-[#009B3A]", bg: "bg-[#009B3A]/10" },
  user:        { label: "Member",      color: "text-white/50",  bg: "bg-white/[0.06]" },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_LABELS[role] ?? ROLE_LABELS.user;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}
    >
      <ShieldCheck className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

// ── Inline feedback banner ────────────────────────────────────────────────────

function Banner({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] ${
        type === "success"
          ? "border-[#009B3A]/30 bg-[#009B3A]/10 text-[#009B3A]"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.05]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009B3A]/10">
          <Icon className="h-4 w-4 text-[#009B3A]" />
        </div>
        <h2 className="text-sm font-semibold text-white/80">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ── Labelled input ────────────────────────────────────────────────────────────

function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wider text-white/35">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#009B3A]/50 focus:ring-1 focus:ring-[#009B3A]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton({
  loading,
  label,
}: {
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 rounded-xl bg-[#009B3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#009B3A]/85 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Email form state
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const u = await apiClient.getMe();
      setUser(u);
      setNewEmail(u.email);
    } catch {
      // AuthGuard handles 401
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailFeedback(null);
    if (!newEmail.trim()) {
      setEmailFeedback({ type: "error", message: "Email cannot be empty." });
      return;
    }
    if (newEmail === user?.email) {
      setEmailFeedback({ type: "error", message: "That is already your current email." });
      return;
    }
    if (!emailPassword) {
      setEmailFeedback({ type: "error", message: "Current password is required." });
      return;
    }
    setEmailLoading(true);
    try {
      const updated = await apiClient.updateProfile({
        email: newEmail.trim(),
        current_password: emailPassword,
      });
      setUser(updated);
      setEmailPassword("");
      setEmailFeedback({ type: "success", message: "Email updated successfully." });
    } catch (err) {
      setEmailFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update email.",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (!currentPassword) {
      setPasswordFeedback({ type: "error", message: "Current password is required." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: "error", message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", message: "New passwords do not match." });
      return;
    }
    setPasswordLoading(true);
    try {
      await apiClient.updateProfile({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({ type: "success", message: "Password changed successfully." });
    } catch (err) {
      setPasswordFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to change password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28 md:pb-12 space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009B3A]/10 ring-1 ring-[#009B3A]/25 shrink-0">
            <UserCircle2 className="h-7 w-7 text-[#009B3A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account details and security</p>
          </div>
        </div>

        {/* ── Account info ── */}
        <SectionCard title="Account" icon={UserCircle2}>
          {userLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-48 rounded bg-white/[0.06]" />
              <div className="h-3 w-32 rounded bg-white/[0.04]" />
            </div>
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-white/30 shrink-0" />
                <span className="text-sm text-white/80">{user.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-white/30 shrink-0" />
                <RoleBadge role={user.role} />
              </div>
              <div className="text-[11px] text-white/25 pt-1">
                Member since{" "}
                {new Date(user.created_at).toLocaleDateString("en-JM", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30">Unable to load account info.</p>
          )}
        </SectionCard>

        {/* ── Change email ── */}
        <SectionCard title="Change Email" icon={Mail}>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Field
              label="New Email Address"
              id="new-email"
              type="email"
              value={newEmail}
              onChange={setNewEmail}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={userLoading}
            />
            <Field
              label="Current Password"
              id="email-current-password"
              type="password"
              value={emailPassword}
              onChange={setEmailPassword}
              placeholder="Confirm with your current password"
              autoComplete="current-password"
            />
            {emailFeedback && (
              <Banner type={emailFeedback.type} message={emailFeedback.message} />
            )}
            <SubmitButton loading={emailLoading} label="Update Email" />
          </form>
        </SectionCard>

        {/* ── Change password ── */}
        <SectionCard title="Change Password" icon={Lock}>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Field
              label="Current Password"
              id="curr-password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Your current password"
              autoComplete="current-password"
            />
            <Field
              label="New Password"
              id="new-password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <Field
              label="Confirm New Password"
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
            {passwordFeedback && (
              <Banner type={passwordFeedback.type} message={passwordFeedback.message} />
            )}
            <SubmitButton loading={passwordLoading} label="Change Password" />
          </form>
        </SectionCard>

      </main>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <AuthGuard>
      <ProfilePage />
    </AuthGuard>
  );
}
