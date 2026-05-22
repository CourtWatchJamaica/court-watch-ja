"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { AdminUserRow, AdminUserDetail } from "@/lib/types";
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Bell,
  Briefcase,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

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

function Avatar({ email, name }: { email: string; name?: string | null }) {
  const initial = (name ?? email)[0]?.toUpperCase() ?? "?";
  const hue = Array.from(email).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
      style={{ background: `hsl(${hue},50%,28%)` }}
    >
      {initial}
    </div>
  );
}

function ExpandedRow({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.adminGetUserDetail(userId).then((r) => {
      setDetail(r.user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="px-6 py-4 flex items-center gap-2 text-xs text-white/30">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="px-6 pb-5 pt-2 grid md:grid-cols-2 gap-5 border-b border-white/[0.04]">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2 flex items-center gap-1.5">
          <Briefcase className="h-3 w-3" /> Tracked Cases
        </p>
        {detail.tracked_cases.length === 0 ? (
          <p className="text-xs text-white/20">None</p>
        ) : (
          <div className="space-y-1.5">
            {detail.tracked_cases.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/60">
                  {c.case_number ?? "(number pending)"}
                </span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/35">
                  {c.case_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2 flex items-center gap-1.5">
          <Bell className="h-3 w-3" /> Recent Notifications
        </p>
        {detail.recent_notifications.length === 0 ? (
          <p className="text-xs text-white/20">None</p>
        ) : (
          <div className="space-y-1.5">
            {detail.recent_notifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-white/60 truncate">
                  {n.title ?? n.type}
                </span>
                <span className="text-[10px] text-white/25 shrink-0">
                  {new Date(n.sent_at).toLocaleDateString("en-JM", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="md:col-span-2 text-[10px] text-white/20 hover:text-white/50 transition-colors text-right"
      >
        Collapse ↑
      </button>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(
    async (qVal: string, roleVal: string, pg: number) => {
      setLoading(true);
      try {
        const res = await apiClient.adminListUsersFiltered({
          q: qVal || undefined,
          role: roleVal || undefined,
          page: pg,
          limit: LIMIT,
        });
        setUsers(res.users);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchUsers(q, roleFilter, page);
  }, [fetchUsers, page, roleFilter]);

  const handleSearch = (val: string) => {
    setQ(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchUsers(val, roleFilter, 1), 350);
  };

  const handleRoleFilter = (val: string) => {
    setRoleFilter(val);
    setPage(1);
    fetchUsers(q, val, 1);
  };

  const handleRoleChange = async (userId: number, role: "user" | "admin" | "super_admin") => {
    setActionUserId(userId);
    setError(null);
    try {
      await apiClient.adminSetUserRole(userId, role);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      showToast("Role updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActionUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setActionUserId(id);
    setError(null);
    try {
      await apiClient.adminDeleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setTotal((t) => t - 1);
      showToast("User deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setActionUserId(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          resourceName={`user ${deleteTarget.email}`}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Users className="h-5 w-5 text-blue-400 shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-white/40 mt-0.5">Manage roles and access</p>
        </div>
        <div className="flex-1" />
        <div className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/50">
          {total} total
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search name or email…"
            className="h-[42px] w-full rounded-xl border border-white/[0.08] bg-black/20 pl-9 pr-8 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none transition-colors"
          />
          {q && (
            <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => handleRoleFilter(e.target.value)}
          className="h-[42px] rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 focus:outline-none cursor-pointer"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] overflow-hidden">
        <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <span className="w-8" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">User</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Cases</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Joined</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Role</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Actions</span>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] animate-pulse">
                <div className="h-8 w-8 rounded-full bg-white/[0.06]" />
                <div className="space-y-1.5">
                  <div className="h-3 w-48 rounded bg-white/[0.06]" />
                  <div className="h-2.5 w-24 rounded bg-white/[0.04]" />
                </div>
                <div className="h-3 w-6 rounded bg-white/[0.04]" />
                <div className="h-3 w-20 rounded bg-white/[0.04]" />
                <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
                <div className="h-[44px] w-[80px] rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-8 w-8 text-white/10 mb-3" />
            <p className="text-sm text-white/30">No users found</p>
          </div>
        ) : (
          <div>
            {users.map((user) => {
              const RoleIcon = ROLE_ICONS[user.role] ?? Shield;
              const isBusy = actionUserId === user.id;
              const isExpanded = expandedId === user.id;

              return (
                <div key={user.id}>
                  {/* Main row */}
                  <div
                    className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : user.id)}
                  >
                    {/* Expand indicator */}
                    <div className="flex items-center justify-center w-8">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-white/30" />
                        : <ChevronRight className="h-3.5 w-3.5 text-white/20" />}
                    </div>

                    {/* Identity */}
                    <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Avatar email={user.email} name={user.display_name} />
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">
                          {user.display_name ?? user.email}
                        </p>
                        {user.display_name && (
                          <p className="text-[10px] text-white/30 truncate">{user.email}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-white/20 font-mono">#{user.id}</p>
                          {user.email_verified
                            ? <CheckCircle2 className="h-2.5 w-2.5 text-[#009B3A]/60" />
                            : <XCircle className="h-2.5 w-2.5 text-amber-400/40" />}
                        </div>
                      </div>
                    </div>

                    {/* Case count */}
                    <span
                      className="text-xs text-white/30 font-mono min-w-[1.5rem] text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {user.case_count}
                    </span>

                    {/* Joined date */}
                    <span
                      className="text-xs text-white/30 whitespace-nowrap hidden md:block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {new Date(user.created_at).toLocaleDateString("en-JM", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>

                    {/* Role */}
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${ROLE_COLORS[user.role]}`}>
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

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(user); }}
                      disabled={isBusy}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
                      aria-label="Delete user"
                    >
                      {isBusy
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                    </button>
                  </div>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <ExpandedRow userId={user.id} onClose={() => setExpandedId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-[36px] px-3 rounded-lg border border-white/[0.08] text-xs text-white/50 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-white/30">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-[36px] px-3 rounded-lg border border-white/[0.08] text-xs text-white/50 hover:text-white hover:border-white/20 disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[#009B3A]/30 bg-[#0d0d1a] px-4 py-3 shadow-2xl flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#009B3A]" />
          <p className="text-sm text-white/90">{toast}</p>
        </div>
      )}
    </div>
  );
}
