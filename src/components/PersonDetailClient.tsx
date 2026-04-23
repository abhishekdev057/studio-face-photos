"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, ImageIcon, Trash2, ExternalLink } from "lucide-react";
import { deletePerson, deletePhoto } from "@/actions/delete";
import { useRouter } from "next/navigation";

interface PersonDetailClientProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  canManage: boolean;
  person: {
    id: string;
    name: string | null;
    faceCount: number;
  };
  initialPhotos: Array<{
    id: string;
    url: string;
    faceCount: number;
  }>;
}

export default function PersonDetailClient({
  workspaceId,
  workspaceSlug,
  workspaceName,
  canManage,
  person,
  initialPhotos,
}: PersonDetailClientProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const router = useRouter();

  const handleDeleteAlbum = async () => {
    if (!confirm("Delete this guest group and remove all its matched album entries?")) {
      return;
    }

    setDeletingAlbum(true);
    const result = await deletePerson(person.id, workspaceId);
    if (result.success) {
      router.push(`/organizer?workspace=${workspaceSlug}`);
      router.refresh();
      return;
    }

    alert(result.error ?? "Failed to delete album");
    setDeletingAlbum(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Delete this photo from the workspace?")) {
      return;
    }

    setDeletingPhotoId(photoId);
    const result = await deletePhoto(photoId, workspaceId);
    if (result.success) {
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      router.refresh();
    } else {
      alert(result.error ?? "Failed to delete photo");
    }
    setDeletingPhotoId(null);
  };

  return (
    <div className="min-h-screen px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/organizer?workspace=${workspaceSlug}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 transition hover:bg-white"
              >
                <ArrowLeft className="h-5 w-5 text-slate-700" />
              </Link>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{workspaceName}</div>
                <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-950">
                  <User className="h-6 w-6 text-slate-500" />
                  {person.name || "Detected guest group"}
                </h1>
                <p className="text-sm text-slate-500">
                  {photos.length} photo{photos.length === 1 ? "" : "s"} across {person.faceCount} recognized face match
                  {person.faceCount === 1 ? "" : "es"}.
                </p>
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAlbum}
                  disabled={deletingAlbum}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingAlbum ? "Deleting..." : "Delete guest group"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-3xl font-semibold text-slate-950">{photos.length}</div>
            <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <ImageIcon className="h-4 w-4" />
              Photos surfaced
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-3xl font-semibold text-slate-950">{person.faceCount}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Face matches kept in album</div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="text-3xl font-semibold text-slate-950">{workspaceName}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Active workspace</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Matched workspace photo"
                className={`h-full w-full object-cover transition duration-500 ${deletingPhotoId === photo.id ? "opacity-20" : "group-hover:scale-105"}`}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent opacity-70" />

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletingPhotoId === photo.id}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 backdrop-blur-md transition hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingPhotoId === photo.id ? "Removing..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
            No photos are still attached to this guest group.
          </div>
        )}
      </div>
    </div>
  );
}
