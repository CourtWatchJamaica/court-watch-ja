"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import {
  UserCircle2,
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009B3A]/10">
          <Icon className="h-4 w-4 text-[#009B3A]" />
        </div>
        <h2 className="text-sm font-semibold text-foreground/80">{title}</h2>
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
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-[#009B3A]/50 focus:ring-1 focus:ring-[#009B3A]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Delete account modal ──────────────────────────────────────────────────────

function DeleteAccountModal({
  onClose,
  onConfirm,
  loading,
  feedback,
}: {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
}) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background/95 backdrop-blur-sm p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 shrink-0">
            <Trash2 className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Delete Account</h2>
            <p className="text-[11px] text-muted-foreground">This cannot be undone</p>
          </div>
        </div>

        {/* Warning */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          All your tracked cases, notification preferences, and account data will be{" "}
          <span className="text-foreground font-medium">permanently deleted</span>. There is no recovery.
        </p>

        {/* Confirmation input */}
        <div className="space-y-1.5">
          <label htmlFor="modal-delete-confirm" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Type DELETE to confirm
          </label>
          <input
            id="modal-delete-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="w-full rounded-xl border border-red-500/30 bg-background/50 px-4 py-3 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/25 transition-colors"
          />
        </div>

        {feedback && <Banner type={feedback.type} message={feedback.message} />}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmText.toUpperCase() !== "DELETE"}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete My Account
          </button>
        </div>
      </div>
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Display name form state
  const [displayName, setDisplayName] = useState("");
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameFeedback, setDisplayNameFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    searchParams.get("success") === "password_changed"
      ? { type: "success", message: "Password updated successfully." }
      : null,
  );

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteGoodbye, setDeleteGoodbye] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteFeedback(null);
    try {
      await apiClient.deleteAccount();
      localStorage.removeItem("token");
      setShowDeleteModal(false);
      setDeleteGoodbye(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setDeleteFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete account.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadUser = useCallback(async () => {
    try {
      const u = await apiClient.getMe();
      setUser(u);
      setDisplayName(u.display_name ?? "");
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

  const handleDisplayNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisplayNameFeedback(null);
    setDisplayNameLoading(true);
    try {
      const updated = await apiClient.updateProfile({ display_name: displayName.trim() || null });
      setUser(updated);
      setDisplayName(updated.display_name ?? "");
      setDisplayNameFeedback({ type: "success", message: "Display name updated." });
    } catch (err) {
      setDisplayNameFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update display name.",
      });
    } finally {
      setDisplayNameLoading(false);
    }
  };

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
      const res = await apiClient.requestPasswordChange(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({ type: "success", message: res.message });
    } catch (err) {
      setPasswordFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to request password change.",
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
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#009B3A]/10 ring-1 ring-[#009B3A]/25 shrink-0">
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
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted/60" />
            </div>
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <span className="text-sm text-foreground/80">{user.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <RoleBadge role={user.role} />
              </div>
              <div className="text-[11px] text-muted-foreground/60 pt-1">
                Member since{" "}
                {new Date(user.created_at).toLocaleDateString("en-JM", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load account info.</p>
          )}
        </SectionCard>

        {/* ── Display name ── */}
        <SectionCard title="Display Name" icon={Pencil}>
          <form onSubmit={handleDisplayNameSubmit} className="space-y-4">
            <Field
              label="Display Name"
              id="display-name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="e.g. Counsellor Smith (leave blank to reset)"
              autoComplete="nickname"
              disabled={userLoading}
            />
            <p className="text-[11px] text-muted-foreground/60">
              Shown in the dashboard greeting. Leave blank to use the default "Counsellor".
            </p>
            {displayNameFeedback && (
              <Banner type={displayNameFeedback.type} message={displayNameFeedback.message} />
            )}
            <SubmitButton loading={displayNameLoading} label="Save Name" />
          </form>
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

        {/* ── Delete account ── */}
        <div className="pt-2 pb-2">
          {deleteGoodbye ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#009B3A]/30 bg-[#009B3A]/10 px-4 py-3 text-[13px] text-[#009B3A]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Your account has been deleted. Redirecting…
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/50 active:scale-[0.97] transition-all duration-150"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          )}
        </div>

        {showDeleteModal && (
          <DeleteAccountModal
            onClose={() => { setShowDeleteModal(false); setDeleteFeedback(null); }}
            onConfirm={handleDeleteAccount}
            loading={deleteLoading}
            feedback={deleteFeedback}
          />
        )}

      </main>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <AuthGuard>
      <Suspense>
        <ProfilePage />
      </Suspense>
    </AuthGuard>
  );
}
