import { auth } from "@/auth";
import { doLogout } from "@/actions/logout-action";
import { isOrganizer } from "@/lib/workspaces";
import Link from "next/link";
import { ChevronRight, LogOut, LayoutPanelTop } from "lucide-react";

export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return null;
  }

  const dashboardHref = isOrganizer(user.role) ? "/organizer" : "/guest";
  const dashboardLabel = isOrganizer(user.role) ? "Organizer" : "Guest";
  const roleLabel =
    user.role === "ADMIN" ? "System admin" : user.role === "ORGANIZER" ? "Organizer" : "Public";

  return (
    <nav className="sticky top-0 z-50 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
      <div className="page-shell flex min-h-[5.25rem] flex-wrap items-center justify-between gap-3 py-3">
        <Link
          href={dashboardHref}
          className="group flex items-center gap-3 text-slate-950 transition hover:opacity-95"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-sky-300 via-cyan-300 to-blue-500 text-slate-950 shadow-[0_14px_35px_rgba(54,182,255,0.28)] transition group-hover:scale-[1.02]">
            <LayoutPanelTop className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-sky-500">Aura</div>
            <div className="text-sm font-semibold tracking-tight">Private Face Workspace</div>
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_24px_rgba(8,18,36,0.04)] transition hover:border-slate-300 hover:text-slate-950 sm:px-4 sm:text-sm"
          >
            {dashboardLabel === "Organizer" ? "Control room" : "Guest access"}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/88 px-3 py-2 shadow-[0_10px_24px_rgba(8,18,36,0.04)] sm:px-4">
            <div className="hidden text-right lg:block">
              <div className="text-sm font-medium text-slate-950">{user.name || "Workspace User"}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <div className="rounded-full bg-slate-100/90 px-3 py-1 text-[11px] font-medium text-slate-600 sm:text-xs">
              {roleLabel}
            </div>

            <form action={doLogout}>
              <button
                type="submit"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
