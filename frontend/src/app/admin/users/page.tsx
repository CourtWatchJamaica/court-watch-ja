"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { AdminUser } from "@/lib/types";
import { Users, Trash2, Shield, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

const ROLE_LABELS: Record<string, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-white/[0.07] text-white/50",
  admin: "bg-blue-500/15 text-blue-400",
  super_admin: "bg-[#FED100]/15 text-[#FED100]",
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user: Shield,
  admin: ShieldCheck,
  super_admin: ShieldAlert,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; email: string } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { users: list } = await apiClient.adminListUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: number, role: "user" | "admin" | "super_admin") => {
    setActionUserId(userId);
    setError(null);
    try {
      await apiClient.adminSetUserRole(userId, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
      showToast("Role updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActionUserId(null);
    }
  };

  const handleDelete = async (userId: number) => {
    setConfirmDelete(null);
    setActionUserId(userId);
    setError(null);
    try {
      await apiClient.adminDeleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast("User deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {confirmDelete && (
        <ConfirmModal
          title="Delete user?"
          message={`"${confirmDelete.email}" will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete User"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="mb-6 flex items-center gap-3">
        <Users className="h-5 w-5 text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-white/40 mt-0.5">Manage roles and access</p>
        </div>
        <div className="flex-1" />
        <div className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/50">
          {users.length} total
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Email</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Joined</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Role</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Actions</span>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-4 border-b border-white/[0.04] animate-pulse">
                <div className="h-3.5 w-48 rounded bg-white/[0.06]" />
                <div className="h-3 w-20 rounded bg-white/[0.04]" />
                <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
                <div className="h-[44px] w-[44px] rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {users.map((user) => {
              const RoleIcon = ROLE_ICONS[user.role] ?? Shield;
              const isBusy = actionUserId === user.id;
              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white/80 truncate">{user.email}</p>
                    <p className="text-[10px] text-white/25 font-mono">#{user.id}</p>
                  </div>

                  <span className="text-xs text-white/30 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString("en-JM", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${ROLE_COLORS[user.role]}`}>
                      <RoleIcon className="h-3 w-3" />
                      {ROLE_LABELS[user.role]}
                    </span>
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 text-white/30 animate-spin" />
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as "user" | "admin" | "super_admin")
                        }
                        className="h-[44px] rounded-lg bg-white/[0.06] px-2 text-[10px] text-white/60 border border-white/[0.08] focus:outline-none cursor-pointer"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    )}
                  </div>

                  <button
                    onClick={() => setConfirmDelete({ id: user.id, email: user.email })}
                    disabled={isBusy}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label="Delete user"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-3 shadow-2xl flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#009B3A]" />
          <p className="text-sm text-white/90">{toast}</p>
        </div>
      )}
    </div>
  );
}
