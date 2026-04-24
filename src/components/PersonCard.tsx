"use client";

import { Trash2, User, Users } from "lucide-react";
import Link from "next/link";
import { deletePerson } from "@/actions/delete";
import { getOrganizerPersonPath } from "@/lib/workspaces";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface PersonCardProps {
  workspaceId: string;
  workspaceSlug: string;
  canManage: boolean;
  person: {
    id: string;
    name: string | null;
    faceCount: number;
    coverUrl?: string | null;
  };
}

export default function PersonCard({
  workspaceId,
  workspaceSlug,
  canManage,
  person,
}: PersonCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setDeleteError(null);
      return;
    }

    setDeleting(true);
    const result = await deletePerson(person.id, workspaceId);
    if (result.success) {
      router.refresh();
      return;
    }

    setDeleteError(result.error ?? "Failed to delete guest group");
    setConfirmingDelete(false);
    setDeleting(false);
  };

  if (deleting) {
    return null;
  }

  return (
    <div className="group overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-slate-300">
      <Link href={getOrganizerPersonPath(workspaceSlug, person.id)} className="block">
        <div className="relative aspect-[0.92] overflow-hidden">
          {person.coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={person.coverUrl}
                alt={person.name || "Detected person"}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.6),_transparent_55%),linear-gradient(180deg,#f8fafc,#e2e8f0)]">
              <User className="h-10 w-10 text-slate-400" />
            </div>
          )}

          <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md">
            Album {person.faceCount}
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">{person.name || "Guest cluster"}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" />
              {person.faceCount} matched face{person.faceCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {confirmingDelete && !deleting && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setConfirmingDelete(false);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`inline-flex w-full items-center justify-center rounded-full px-3 py-2.5 text-xs font-medium transition ${
                  confirmingDelete
                    ? "border border-red-300 bg-red-100 text-red-800 hover:bg-red-200"
                    : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                }`}
                title="Delete guest group"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deleting ? "Deleting..." : confirmingDelete ? "Confirm delete" : "Delete group"}
              </button>
            </div>

            {deleteError && <div className="text-xs text-red-600">{deleteError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
