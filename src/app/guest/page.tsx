import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Link2, ShieldCheck } from "lucide-react";
import { isOrganizer } from "@/lib/workspaces";

export default async function GuestPage() {
  const session = await auth();
  if (session?.user && isOrganizer(session.user.role)) {
    redirect("/organizer");
  }

  const hasSignedInViewer = !!session?.user;

  return (
    <div className="page-shell flex min-h-[calc(100vh-78px)] items-center justify-center overflow-hidden py-10 text-slate-950">
      <section className="hero-surface relative w-full max-w-5xl overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_50%_36%,rgba(103,232,249,0.28),transparent_32%),linear-gradient(135deg,#020617,#0f172a)] lg:block" />
        <div className="relative grid min-h-[520px] lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col justify-center p-8 md:p-12">
            <div className="eyebrow-badge w-fit">
              <ShieldCheck className="h-3.5 w-3.5" />
              Guest mode
            </div>

            <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-tight md:text-6xl">
              {hasSignedInViewer ? "Public access only." : "Open your private link."}
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-500">
              {hasSignedInViewer
                ? "This account is not assigned as an organizer. Use a workspace guest link to open the camera scan."
                : "Guest photo access works only from a secure workspace link shared by the organizer."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="surface-card-muted p-4">
                <Camera className="h-5 w-5 text-slate-700" />
                <div className="mt-3 text-sm font-semibold text-slate-950">Camera scan</div>
                <p className="mt-1 text-sm text-slate-500">Live capture only.</p>
              </div>
              <div className="surface-card-muted p-4">
                <Link2 className="h-5 w-5 text-slate-700" />
                <div className="mt-3 text-sm font-semibold text-slate-950">Private link</div>
                <p className="mt-1 text-sm text-slate-500">Starts with /w/...</p>
              </div>
            </div>

            {!hasSignedInViewer && (
              <div className="mt-8">
                <Link href="/login" className="action-primary px-5 py-3">
                  Organizer sign in
                </Link>
              </div>
            )}
          </div>

          <div className="relative hidden items-center justify-center p-10 lg:flex">
            <div className="absolute h-80 w-80 rounded-full border border-cyan-200/20" />
            <div className="absolute h-56 w-56 rounded-full border border-cyan-200/30" />
            <div className="relative flex h-44 w-44 items-center justify-center rounded-[3rem] bg-white/10 text-cyan-100 shadow-[0_0_80px_rgba(103,232,249,0.18)] backdrop-blur">
              <Camera className="h-16 w-16" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
