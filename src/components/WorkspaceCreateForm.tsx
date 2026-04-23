"use client";

import { createWorkspace } from "@/actions/workspace";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FolderPlus, Loader2 } from "lucide-react";

export default function WorkspaceCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const name = String(formData.get("name") ?? "");
        const description = String(formData.get("description") ?? "");

        startTransition(async () => {
          const result = await createWorkspace(name, description);
          if (!result.success || !result.workspaceSlug) {
            setError(result.error ?? "Unable to create workspace.");
            return;
          }

          setError(null);
          form.reset();
          router.push(`/organizer?workspace=${result.workspaceSlug}`);
          router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <div className="text-sm font-semibold text-slate-950">Create workspace</div>
        <p className="text-sm text-slate-500">One workspace per event, client, or secure gallery.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace name</span>
        <input
          required
          minLength={3}
          name="name"
          placeholder="Spring Wedding 2026"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none ring-0 placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Description</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Short note for your team"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white"
        />
      </label>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
        {isPending ? "Creating..." : "Create workspace"}
      </button>
    </form>
  );
}
