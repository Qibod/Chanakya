"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { UserRole } from "@grc/types";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  active: boolean;
}

interface UserTableProps {
  initialUsers: TeamUser[];
}

const ROLE_OPTIONS = [
  UserRole.OrgAdmin,
  UserRole.AuditDirector,
  UserRole.ControlOwner,
  UserRole.ReadOnly,
  UserRole.BoardExecutive,
  UserRole.ExternalAuditor,
  UserRole.Developer,
] as const;

async function patchUserRole(userId: string, role: string) {
  const res = await fetch(`/api/v1/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Failed to update role (${res.status})`);
  }
  return res.json();
}

async function deactivateUser(userId: string) {
  const res = await fetch(`/api/v1/users/${userId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Failed to deactivate user (${res.status})`);
  }
}

export function UserTable({ initialUsers }: UserTableProps) {
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      patchUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {initialUsers.map((user) => {
              const isSelf = currentUser?.id === user.id;
              const isPending =
                roleMutation.isPending || deactivateMutation.isPending;

              return (
                <tr key={user.id} className="bg-slate-900 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">
                    {user.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role ?? ""}
                      disabled={isPending || !user.active}
                      onChange={(e) =>
                        roleMutation.mutate({ userId: user.id, role: e.target.value })
                      }
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {!user.role && <option value="">No role</option>}
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={isSelf || isPending || !user.active}
                      onClick={() => deactivateMutation.mutate(user.id)}
                      title={isSelf ? "Cannot deactivate yourself" : "Deactivate user"}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {initialUsers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}
