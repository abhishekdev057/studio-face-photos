import { redirect } from "next/navigation";
import { auth } from "@/auth";
import GoogleLoginForm from "@/components/GoogleLoginForm";
import { isOrganizer } from "@/lib/workspaces";
import { Camera, FolderKanban, ScanFace, Shield } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(isOrganizer(session.user.role) ? "/organizer" : "/guest");
  }

  return (
    <div className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="relative z-10 grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
            <Camera className="h-3.5 w-3.5" />
            Private face workspace
          </div>

          <div className="mt-6 max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Private photo access, clean workspace control.
            </h1>
            <p className="text-base leading-7 text-slate-500 md:text-lg">
              Upload originals. Match faces. Share one selfie link.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: FolderKanban,
                title: "Workspaces",
                body: "Keep every event separate.",
              },
              {
                icon: Shield,
                title: "Private access",
                body: "Guests only see their own matches.",
              },
              {
                icon: ScanFace,
                title: "Selfie search",
                body: "One face in, matched photos out.",
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <feature.icon className="h-5 w-5 text-slate-700" />
                <div className="mt-4 text-lg font-semibold">{feature.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <Camera className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-semibold">Sign in</h2>
            <p className="text-sm leading-6 text-slate-500">
              Your workspace stays behind your account.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <GoogleLoginForm />
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Upload only the photos you have permission to process and share.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
