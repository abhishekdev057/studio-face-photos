"use client";

import { createWorkspace } from "@/actions/workspace";
import { getOrganizerWorkspacePath } from "@/lib/workspaces";
import { FolderPlus, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export default function WorkspaceCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isPending]);

  return (
    <>
      <section className="surface-card relative overflow-hidden p-6 sm:p-7">
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-100/80 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="icon-badge">
              <Plus className="h-5 w-5" />
            </div>

            <div className="space-y-3">
              <div className="eyebrow-badge">Create workspace</div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                  New private workspace
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  One event. One clean control page.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-card-muted flex items-start gap-3 p-4">
              <Sparkles className="mt-0.5 h-4 w-4 text-sky-600" />
              <div className="text-sm text-slate-600">
                Setup opens in a modal and takes you straight into the workspace.
              </div>
            </div>

            <button type="button" onClick={() => setOpen(true)} className="action-primary w-full py-3">
              <Plus className="h-4 w-4" />
              New workspace
            </button>
          </div>
        </div>
      </section>

      {open && (
        <div className="modal-backdrop" onClick={() => !isPending && setOpen(false)}>
          <div className="modal-panel animate-enter p-6 sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="eyebrow-badge">Workspace setup</div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Create workspace</h3>
                  <p className="mt-2 text-sm text-slate-500">Name it, add a short note, and open it.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
                aria-label="Close create workspace modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
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
                  setOpen(false);
                  form.reset();
                  router.push(getOrganizerWorkspacePath(result.workspaceSlug));
                  router.refresh();
                });
              }}
            >
              <label className="block space-y-2">
                <span className="field-label">Workspace name</span>
                <input
                  required
                  minLength={3}
                  name="name"
                  placeholder="Spring wedding 2026"
                  className="field-input"
                />
              </label>

              <label className="block space-y-2">
                <span className="field-label">Team note</span>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Bride side gallery and guest search"
                  className="field-textarea"
                />
              </label>

              {error && (
                <div className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="action-secondary py-3"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="action-primary py-3">
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  {isPending ? "Creating..." : "Create workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
