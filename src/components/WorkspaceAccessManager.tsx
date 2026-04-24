"use client";

import {
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
} from "@/actions/workspace";
import { WorkspaceRole } from "@prisma/client";
import { Loader2, MailPlus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

interface WorkspaceMemberRecord {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: WorkspaceRole;
}

interface WorkspaceInviteRecord {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

interface WorkspaceAccessManagerProps {
  workspaceId: string;
  ownerId: string;
  currentUserId: string;
  members: WorkspaceMemberRecord[];
  invites: WorkspaceInviteRecord[];
}

const roleOptions: WorkspaceRole[] = ["MANAGER", "CONTRIBUTOR"];

function formatRole(role: WorkspaceRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default function WorkspaceAccessManager({
  workspaceId,
  ownerId,
  currentUserId,
  members,
  invites,
}: WorkspaceAccessManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>("CONTRIBUTOR");
  const [email, setEmail] = useState("");

  const activeMembers = useMemo(
    () =>
      members.map((member) => ({
        ...member,
        isOwner: member.userId === ownerId || member.role === "OWNER",
      })),
    [members, ownerId],
  );

  return (
    <div className="surface-card space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="eyebrow-badge">
            <Users className="h-3.5 w-3.5" />
            Workspace team
          </div>
          <div className="mt-4 text-xl font-semibold text-slate-950">Access and roles</div>
          <p className="text-sm text-slate-500">Invite organizers and set their level.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {activeMembers.length} active
        </div>
      </div>

      <div className="surface-card-muted px-4 py-3 text-sm text-slate-500">
        Organizers open the dashboard. Guests use the private camera link.
      </div>

      <form
        className="grid gap-3 md:grid-cols-[1.6fr_0.7fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await inviteWorkspaceMember(workspaceId, email, selectedRole);
            if (!result.success) {
              setError(result.error ?? "Unable to update workspace access.");
              setMessage(null);
              return;
            }

            setError(null);
            setMessage(result.message ?? "Workspace access updated.");
            setEmail("");
            router.refresh();
          });
        }}
      >
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          className="field-input"
        />
        <select
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as WorkspaceRole)}
          className="field-select"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {formatRole(role)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
          Add organizer
        </button>
      </form>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {activeMembers.map((member) => (
          <div
            key={member.userId}
            className="surface-card-muted flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="text-sm font-medium text-slate-950">{member.name || member.email || "Unnamed user"}</div>
              <div className="text-sm text-slate-500">{member.email || "No email available"}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                {member.isOwner ? "Owner" : formatRole(member.role)}
              </div>
              {!member.isOwner && member.userId !== currentUserId && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeWorkspaceMember(workspaceId, member.userId);
                      if (!result.success) {
                        setError(result.error ?? "Unable to remove workspace member.");
                        return;
                      }

                      setError(null);
                      setMessage("Workspace access removed.");
                      router.refresh();
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending invites</div>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="text-sm font-medium text-slate-950">{invite.email}</div>
                <div className="text-sm text-slate-500">{formatRole(invite.role)} access on first sign-in.</div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeWorkspaceInvite(workspaceId, invite.id);
                    if (!result.success) {
                      setError(result.error ?? "Unable to revoke workspace invite.");
                      return;
                    }

                    setError(null);
                    setMessage("Invite revoked.");
                    router.refresh();
                  })
                }
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Invite
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
