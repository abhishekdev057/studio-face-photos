import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isOrganizer } from "@/lib/workspaces";

export default async function GuestPage() {
  const session = await auth();
  if (session?.user && isOrganizer(session.user.role)) {
    redirect("/organizer");
  }

  const hasSignedInViewer = !!session?.user;

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          {hasSignedInViewer ? "Public access only" : "Guest access moved"}
        </div>
        <h1 className="mt-4 text-4xl font-semibold">
          {hasSignedInViewer ? "This account is not an organizer" : "Open your selfie link"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">
          {hasSignedInViewer ? (
            <>
              Ask a system admin to add you to a workspace, or use a guest link that starts with{" "}
              <span className="font-mono text-slate-700">/w/...</span>.
            </>
          ) : (
            <>
              Ask your organizer for a link that starts with{" "}
              <span className="font-mono text-slate-700">/w/...</span>.
            </>
          )}
        </p>
        {!hasSignedInViewer && (
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Organizer sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
