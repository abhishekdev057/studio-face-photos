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
    <div className="page-shell relative flex min-h-[calc(100vh-78px)] items-center justify-center overflow-hidden py-10 text-slate-950">
      <div className="relative z-10 grid w-full max-w-6xl gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <section className="hero-surface p-8 md:p-10">
          <div className="eyebrow-badge">
            <Camera className="h-3.5 w-3.5" />
            Private face workspace
          </div>

          <div className="mt-6 max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Enterprise photo access with strict private matching.
            </h1>
            <p className="text-base leading-7 text-slate-500 md:text-lg">
              Keep every workspace separate, verify people conservatively, and share one secure camera-only access link.
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
                title: "Camera search",
                body: "One scan in, matched photos out.",
              },
            ].map((feature) => (
              <div key={feature.title} className="surface-card-muted p-5">
                <feature.icon className="h-5 w-5 text-slate-700" />
                <div className="mt-4 text-lg font-semibold">{feature.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <Camera className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-semibold">Sign in</h2>
            <p className="text-sm leading-6 text-slate-500">
              Your dashboard, team access, and guest links stay behind your account.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <GoogleLoginForm />
            <div className="surface-card-muted px-4 py-4 text-sm text-slate-500">
              Upload only the photos you have permission to process and share.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
