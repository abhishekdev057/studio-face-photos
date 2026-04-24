import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import {
  formatGlobalRole,
  formatWorkspaceRole,
  getOrganizerWorkspacePath,
  isAdmin,
  type WorkspaceListItem,
} from "@/lib/workspaces";

interface WorkspaceDirectoryProps {
  workspaces: WorkspaceListItem[];
  currentUserId: string;
  globalRole?: "ADMIN" | "ORGANIZER" | "VIEWER";
  activeSlug?: string | null;
  title?: string;
  description?: string;
  listClassName?: string;
}

export default function WorkspaceDirectory({
  workspaces,
  currentUserId,
  globalRole,
  activeSlug,
  title = "Your workspaces",
  description = "Open a workspace and keep every action inside that single page.",
  listClassName = "grid gap-3 lg:grid-cols-2",
}: WorkspaceDirectoryProps) {
  return (
    <section className="surface-card p-5 sm:p-6 lg:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow-badge">Workspace directory</div>
          <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
        </div>
      </div>

      {workspaces.length === 0 ? (
        <div className="empty-state mt-5">
          No workspace access yet.
        </div>
      ) : (
        <div className={`mt-5 ${listClassName}`}>
          {workspaces.map((workspace) => {
            const isActive = workspace.slug === activeSlug;
            const membershipRole = isAdmin(globalRole)
              ? "ADMIN"
              : workspace.ownerId === currentUserId
                ? "OWNER"
                : workspace.members[0]?.role ?? "VIEWER";

            return (
              <Link
                key={workspace.id}
                href={getOrganizerWorkspacePath(workspace.slug)}
                className={`group rounded-[1.6rem] border px-4 py-4 transition sm:px-5 ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
                    : "border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.95))] text-slate-950 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold">{workspace.name}</div>
                    <div
                      className={`mt-1 text-xs uppercase tracking-[0.18em] ${
                        isActive ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {membershipRole === "ADMIN"
                        ? formatGlobalRole(globalRole)
                        : formatWorkspaceRole(membershipRole)}
                    </div>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      isActive ? "bg-white/10 text-slate-200" : "bg-white text-slate-500"
                    }`}
                  >
                    <FolderKanban className="h-3 w-3" />
                    {workspace._count.photos}
                  </div>
                </div>

                <p
                  className={`mt-4 line-clamp-2 text-sm leading-6 ${
                    isActive ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {workspace.description || "Private uploads, clean processing, and secure guest access."}
                </p>

                <div
                  className={`mt-4 flex flex-wrap items-center gap-3 text-xs ${
                    isActive ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  <span>{workspace._count.people} groups</span>
                  <span>{workspace._count.members} members</span>
                  <span>{workspace._count.invites} invites</span>
                </div>

                <div
                  className={`mt-5 inline-flex items-center gap-2 text-sm font-medium ${
                    isActive ? "text-white" : "text-slate-700"
                  }`}
                >
                  Open workspace
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
